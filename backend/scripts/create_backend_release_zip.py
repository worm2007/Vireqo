from __future__ import annotations

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

EXCLUDED_PARTS = {
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".git",
    "__MACOSX",
    "release",
    "exports",
}
EXCLUDED_NAMES = {".DS_Store", ".env"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".db", ".sqlite", ".sqlite3", ".zip"}


def should_include(path: Path, root: Path) -> bool:
    relative = path.relative_to(root)
    if any(part in EXCLUDED_PARTS for part in relative.parts):
        return False
    if path.name in EXCLUDED_NAMES:
        return False
    if path.name.startswith(".env."):
        return False
    if path.suffix in EXCLUDED_SUFFIXES:
        return False
    return True


def main() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    output_dir = backend_root / "release"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / "Vireqo-Backend-Clean-Release.zip"

    with ZipFile(output_path, "w", compression=ZIP_DEFLATED) as archive:
        for path in sorted(backend_root.rglob("*")):
            if path.is_file() and should_include(path, backend_root):
                archive.write(path, Path("backend") / path.relative_to(backend_root))

    print(f"[release] Created clean backend ZIP: {output_path}")
    print("[release] Excluded .env, local DBs, virtualenv, caches, macOS files and generated zips.")


if __name__ == "__main__":
    main()
