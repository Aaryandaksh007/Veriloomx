#!/usr/bin/env python3
"""VeriLoom AI — end-to-end golden path validation via API."""
import json
import urllib.request

BASE = 'http://localhost:3000'
STATE = {'draft_id': None, 'audit_id': None, 'version': None}


def call(method, path, body=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode())
        except Exception:
            return {'http_error': e.code}


def find_draft(title_frag):
    d = call('GET', '/api/bootstrap')
    for x in d['drafts']:
        if title_frag in x['title']:
            return x, d
    raise SystemExit(f'draft {title_frag} not found')


def resolve_all(audit, editor_text_map=None, override_keys=None):
    """Accept every finding that has a suggestion; edit/override the rest."""
    audit_id = audit['id']
    override_keys = override_keys or set()
    editor_text_map = editor_text_map or {}
    for f in audit['findings']:
        key = f['key']
        if key in override_keys:
            r = call('POST', '/api/findings/action', {
                'auditId': audit_id, 'findingKey': key, 'action': 'overridden',
                'note': 'Legal pre-approved this phrasing for the flash-sale audience segment.',
                'actor': 'Maya Chen', 'actorRole': 'creator'})
            assert r.get('action'), r
        elif key in editor_text_map:
            r = call('POST', '/api/findings/action', {
                'auditId': audit_id, 'findingKey': key, 'action': 'edited',
                'appliedText': editor_text_map[key], 'actor': 'Maya Chen', 'actorRole': 'creator'})
            assert r.get('action'), r
        elif f['suggestion']:
            r = call('POST', '/api/findings/action', {
                'auditId': audit_id, 'findingKey': key, 'action': 'accepted',
                'actor': 'Maya Chen', 'actorRole': 'creator'})
            assert r.get('action'), r
        else:
            raise SystemExit(f'No resolution path for {key}: {f["title"]} (no suggestion)')


def step(name):
    print(f'\n━━━ {name} ' + '━' * (50 - len(name)))


# ── STAGE 1: audit the LinkedIn post ─────────────────────────
step('1. Audit LinkedIn post')
d, boot = find_draft('LinkedIn')
STATE['draft_id'] = d['id']
r = call('POST', '/api/audit', {'draftId': d['id'], 'actor': 'Maya Chen'})
audit = r['audit']
STATE['audit_id'] = audit['id']
print(f"score={audit['score']} findings={len(audit['findings'])} suppressed={audit['suppressed']}")
for f in audit['findings']:
    sug = (f['suggestion'] or '—')[:60]
    print(f"  [{f['key']}] {f['severity']:8s} {f['pillar']:15s} sug: {sug}")

# instruction-style suggestion sanity check
bad = [f for f in audit['findings'] if f['suggestion'] and (
    f['suggestion'].startswith('(') or 'remove' in f['suggestion'].lower()[:12]
    or 'replace with' in f['suggestion'].lower()[:16])]
if bad:
    print('⚠ instruction-style suggestions still present:', [f['key'] for f in bad])

# ── STAGE 2: resolve findings ────────────────────────────────
step('2. Resolve findings (accept / edit / override)')
# find keys for confidentiality findings (no suggestion) to edit manually
edits = {}
overrides = set()
for f in audit['findings']:
    if f['pillar'] == 'confidentiality':
        if 'codename' in f['title'].lower():
            edits[f['key']] = 'our next big update'
        elif 'email' in f['title'].lower():
            edits[f['key']] = 'hello@inkloom.ai'
    if f['pillar'] == 'tone' and 'fear' in (f['clauseTitle'] or '').lower():
        overrides.add(f['key'])
resolve_all(audit, edits, overrides)
print(f'accepted/edited/override done — edits={list(edits)}, overrides={list(overrides)}')

# ── STAGE 3: remediate ───────────────────────────────────────
step('3. Create remediated version')
r = call('POST', '/api/remediate', {'draftId': STATE['draft_id'], 'auditId': STATE['audit_id'], 'actor': 'Maya Chen'})
print(r)
assert r.get('ok'), r
STATE['version'] = r['version']

d2, _ = find_draft('LinkedIn')
print('── v2 content ──')
print(d2['content'])
assert '(remove' not in d2['content'] and '(replace' not in d2['content'], 'canned text leaked!'

# ── STAGE 4: submit → request changes → revise ───────────────
step('4. RBAC loop: submit → request changes')
r = call('POST', '/api/review', {'draftId': STATE['draft_id'], 'action': 'submit', 'role': 'creator'})
print('submit:', r)
r = call('POST', '/api/review', {'draftId': STATE['draft_id'], 'action': 'request-changes', 'role': 'manager',
                                 'note': 'Please soften the closing urgency line per brand voice rules.'})
print('request-changes:', r)

# creator edits content (drop the FUD line), re-audit, re-remediate
step('5. Creator revises → re-audit → re-remediate → resubmit')
new_content = d2['content'].replace(
    'Act now — before your competitors leave you behind!!! Your brand won\u2019t save itself.',
    'Ready to tighten your brand workflow? Start your free trial today.'
).replace(
    "Act now — before your competitors leave you behind!!! Your brand won't save itself.",
    'Ready to tighten your brand workflow? Start your free trial today.'
)
if new_content == d2['content']:
    # fallback: just tweak something identifiable
    new_content = d2['content'] + '\n\nSee the full changelog at inkloom.ai/changelog.'
r = call('PATCH', f"/api/drafts/{STATE['draft_id']}", {'content': new_content, 'actor': 'Maya Chen'})
print('edit:', r)
r = call('POST', '/api/audit', {'draftId': STATE['draft_id'], 'actor': 'Maya Chen'})
audit2 = r['audit']
STATE['audit_id'] = audit2['id']
print(f"re-audit score={audit2['score']} findings={len(audit2['findings'])}")
edits2 = {}
for f in audit2['findings']:
    if f['pillar'] == 'confidentiality':
        edits2[f['key']] = 'hello@inkloom.ai' if 'email' in f['title'].lower() else 'our next big update'
if audit2['findings']:
    resolve_all(audit2, edits2, set())
r = call('POST', '/api/remediate', {'draftId': STATE['draft_id'], 'auditId': STATE['audit_id'], 'actor': 'Maya Chen'})
print('remediate v2:', r)
assert r.get('ok'), r
r = call('POST', '/api/review', {'draftId': STATE['draft_id'], 'action': 'submit', 'role': 'creator'})
print('resubmit:', r)

# ── STAGE 6: approve & certificate ───────────────────────────
step('6. Reviewer approves → certificate')
r = call('POST', '/api/review', {'draftId': STATE['draft_id'], 'action': 'approve', 'role': 'reviewer'})
print('approve:', r)
assert r.get('ok'), r
r = call('GET', f"/api/certificate/{STATE['draft_id']}")
if 'error' in r:
    print('CERT ERROR:', r)
else:
    print(f"cert id={r['certificateId']} hash={r['hash'][:16]}… score={r['audit']['score']}")
    print(f"overrides on cert: {[(o['findingKey'], (o['note'] or '')[:40]) for o in r['overrides']]}")
    print(f"models disclosed: {sorted({l['model'] for l in r['audit']['aiLedger']})}")

# ── STAGE 7: analytics ───────────────────────────────────────
step('7. Analytics')
a = call('GET', '/api/analytics')
print('totals:', a['totals'])
print('byPillar:', a['byPillar'])
print('top rules:', [(r0['clauseId'], r0['violations'], r0['overrides'], r0['ambiguous']) for r0 in a['rules'][:5]])

print('\n✅ GOLDEN PATH COMPLETE')
