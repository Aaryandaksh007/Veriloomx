#!/usr/bin/env python3
"""Exercise a complete, isolated text-draft governance flow against a running app."""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
import uuid


def call(base_url, method, path, body=None):
    request = urllib.request.Request(
        base_url + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors='replace')
        raise RuntimeError(f'{method} {path} returned HTTP {error.code}: {detail}') from error
    except urllib.error.URLError as error:
        raise RuntimeError(f'Cannot reach {base_url}: {error.reason}') from error
    except TimeoutError as error:
        raise RuntimeError(f'{method} {path} timed out while waiting for the app.') from error


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(base_url):
    draft_id = None
    try:
        bootstrap = call(base_url, 'GET', '/api/bootstrap')
        require(isinstance(bootstrap.get('vault'), list), 'Bootstrap did not return the brand vault.')

        draft = call(base_url, 'POST', '/api/drafts', {
            'title': f'Automated demo check {uuid.uuid4().hex[:8]}',
            'channel': 'Web',
            'kind': 'text',
            'creator': 'VeriLoom E2E',
            'content': 'Inkloom is a revolutionary way to keep every launch on brand.',
        }).get('draft')
        require(draft and draft.get('id'), 'Draft creation failed.')
        draft_id = draft['id']

        audit_response = call(base_url, 'POST', '/api/audit', {'draftId': draft_id})
        audit = audit_response.get('audit')
        require(audit and audit.get('id'), 'Audit did not return a persisted audit record.')
        require(0 <= audit.get('score', -1) <= 100, 'Audit score is outside the expected 0–100 range.')
        require(
            any(
                'revolutionary' in f.get('quote', '').lower()
                and (
                    f.get('pillar') == 'terminology'
                    or 'VL-TERM-001' in (f.get('meta', {}).get('alsoViolates') or [])
                )
                for f in audit.get('findings', [])),
            'The deterministic terminology check did not catch the seeded banned term.',
        )
        ai_purposes = {entry.get('purpose', '') for entry in audit.get('aiLedger', [])}
        require(
            any('Tone & Voice RAG audit' in purpose for purpose in ai_purposes)
            and any('Atomic-claim RAG verification' in purpose for purpose in ai_purposes),
            'Both tone and claims Gemini audit calls must complete and be logged.',
        )
        failed_ai = [
            p for p in audit.get('pillars', [])
            if p.get('pillar') in ('tone', 'claims')
            and (p.get('status') == 'skipped'
                 or 'engine failed' in p.get('detail', '').lower()
                 or 'unparseable' in p.get('detail', '').lower())
        ]
        require(not failed_ai, f'An AI audit pillar did not complete successfully: {failed_ai}')
        print(
            f"Audit passed: score {audit['score']}/100, "
            f"{len(audit['findings'])} finding(s), "
            f"{len(audit.get('aiLedger', []))} Gemini call(s) logged."
        )

        for finding in audit['findings']:
            action = 'accepted' if finding.get('suggestion') else 'overridden'
            payload = {
                'auditId': audit['id'],
                'findingKey': finding['key'],
                'action': action,
                'actor': 'VeriLoom E2E',
                'actorRole': 'creator',
            }
            if action == 'overridden':
                payload['note'] = 'Reviewed and retained for this repeatable demo validation.'
            result = call(base_url, 'POST', '/api/findings/action', payload)
            require(result.get('action', {}).get('findingKey') == finding['key'],
                    f"Could not resolve finding {finding['key']}.")

        remediation = call(base_url, 'POST', '/api/remediate', {
            'draftId': draft_id,
            'auditId': audit['id'],
            'actor': 'VeriLoom E2E',
        })
        require(remediation.get('ok'), f'Remediation failed: {remediation}')
        require(remediation.get('version', 0) > draft.get('version', 0),
                'Remediation did not create a new draft version.')

        submitted = call(base_url, 'POST', '/api/review', {
            'draftId': draft_id,
            'action': 'submit',
            'role': 'creator',
        })
        require(submitted.get('status') == 'IN_REVIEW', 'Creator submission did not enter review.')

        approved = call(base_url, 'POST', '/api/review', {
            'draftId': draft_id,
            'action': 'approve',
            'role': 'reviewer',
        })
        require(approved.get('status') == 'APPROVED', 'Reviewer approval failed.')

        certificate = call(base_url, 'GET', f'/api/certificate/{draft_id}')
        require(certificate.get('draft', {}).get('status') == 'APPROVED',
                'Certificate is not tied to an approved draft.')
        require(len(certificate.get('hash', '')) == 64, 'Certificate SHA-256 hash is missing or malformed.')
        require(certificate.get('certificateId'), 'Certificate ID is missing.')
        print(
            f"Golden path passed: remediated v{remediation['version']} -> approved -> "
            f"{certificate['certificateId']} (SHA-256 hash present)."
        )
    finally:
        if draft_id:
            try:
                call(base_url, 'DELETE', f'/api/drafts/{draft_id}')
                print('Temporary E2E draft removed.')
            except RuntimeError as error:
                print(f'Warning: could not remove temporary E2E draft: {error}', file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--base-url',
        default=os.environ.get('VERILOOM_BASE_URL', 'http://localhost:3000'),
        help='URL of the running VeriLoom app (default: http://localhost:3000)',
    )
    args = parser.parse_args()
    run(args.base_url.rstrip('/'))


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as error:
        print(f'E2E failed: {error}', file=sys.stderr)
        sys.exit(1)
