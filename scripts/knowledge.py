#!/usr/bin/env python3
"""Mirror frontend work notes and Git history into a dedicated Obsidian folder."""
import argparse
from datetime import datetime
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
OWNER = '<!-- yogobi-front:generated -->'
NOTES = {'현재 상태.md': 'docs/state.md', '개발 기록.md': 'docs/worklog.md', '연동 명세.md': 'docs/integration.md'}


def git(*args):
    return subprocess.check_output(['git', '-c', 'core.quotePath=false', *args], cwd=ROOT, text=True).strip()


def config(key):
    result = subprocess.run(['git', 'config', '--local', '--get', key], cwd=ROOT, text=True, capture_output=True)
    if result.returncode not in (0, 1):
        raise ValueError(result.stderr)
    return result.stdout.strip()


def write_atomic(path, body):
    # Reuse the backend tracker pattern: replace only generated notes, atomically.
    if path.is_symlink() or (path.exists() and not path.read_text(encoding='utf-8').startswith(OWNER + '\n')):
        raise ValueError(f'기존 사용자 노트는 덮어쓰지 않습니다: {path}')
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as out:
        temporary = Path(out.name)
        try:
            out.write(OWNER + '\n' + body)
            out.flush()
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)


def sync(vault_dir=None):
    setting = vault_dir or config('yogobi.frontVaultDir')
    if not setting:
        raise ValueError('먼저 install --vault-dir 또는 sync --vault-dir로 프로젝트 폴더를 지정하세요.')
    vault = Path(setting).expanduser().resolve()
    if vault == ROOT or ROOT in vault.parents or not any((p / '.obsidian').is_dir() for p in vault.parents):
        raise ValueError('레포 밖의 Obsidian 볼트 안에 있는 전용 하위 폴더를 지정하세요.')
    bodies = {name: (ROOT / source).read_text(encoding='utf-8') for name, source in NOTES.items()}
    links = '\n'.join(f'- [[{name[:-3]}]]' for name in NOTES)
    status = git('status', '--short') or '(없음)'
    history = git('log', '--all', '--date=iso-strict', '--format=%n### %ad · %h%n%s%n', '--name-status')
    # ponytail: full Git history in one note; split by month if it grows too large.
    bodies['요고비 _ 프론트.md'] = f'''# 요고비 _ 프론트

동기화: {datetime.now().astimezone().isoformat(timespec='seconds')}
브랜치: `{git('branch', '--show-current')}` · HEAD: `{git('rev-parse', '--short', 'HEAD')}`
원본: [{ROOT.name}]({ROOT.as_uri()})

{links}

이 폴더의 노트는 자동 생성합니다. 내용은 프론트 저장소의 docs에서 수정하세요.
미커밋 변경은 작업 상태이며 커밋 이력과 구분합니다. API 키·환경 변수·diff 본문은 복사하지 않습니다.

## 현재 작업 트리

```text
{status}
```

## Git 변경 이력

```text
{history}
```
'''
    # Check all destinations first so a handwritten note cannot cause a partial overwrite.
    for name in bodies:
        path = vault / name
        if path.is_symlink() or (path.exists() and not path.read_text(encoding='utf-8').startswith(OWNER + '\n')):
            raise ValueError(f'기존 사용자 노트는 덮어쓰지 않습니다: {path}')
    vault.mkdir(parents=True, exist_ok=True)
    for name, body in bodies.items():
        write_atomic(vault / name, body)
    print(f'Obsidian 동기화 완료: {vault} ({len(bodies)}개 노트)')


def install(vault_dir):
    current = config('core.hooksPath')
    hooks = Path(git('rev-parse', '--git-path', 'hooks'))
    if not hooks.is_absolute():
        hooks = ROOT / hooks
    active = [p for p in hooks.glob('*') if not p.name.endswith('.sample') and os.access(p, os.X_OK)]
    if (current and current != '.githooks') or (not current and active):
        raise ValueError('기존 Git 훅은 덮어쓰지 않습니다. 기존 훅에서 sync를 호출하세요.')
    sync(vault_dir)
    git('config', '--local', 'yogobi.frontVaultDir', str(Path(vault_dir).expanduser().resolve()))
    git('config', '--local', 'core.hooksPath', '.githooks')
    print('커밋·체크아웃·merge 후 자동 추적 설치 완료')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['sync', 'install'])
    parser.add_argument('--vault-dir')
    args = parser.parse_args()
    try:
        if args.command == 'install':
            if not args.vault_dir:
                raise ValueError('install에는 --vault-dir이 필요합니다.')
            install(args.vault_dir)
        else:
            sync(args.vault_dir)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'{error}\n')
