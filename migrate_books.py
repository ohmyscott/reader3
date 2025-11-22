#!/usr/bin/env python3
"""
Migration script to move existing books from project root to dedicated books directory.
Supports migrating both book data directories and EPUB files.
"""
import os
import shutil
import sys
from pathlib import Path
from typing import Tuple


def validate_books_dir(books_dir: str) -> Path:
    """Validate and create the books directory."""
    books_path = Path(books_dir)

    if books_path.exists() and not books_path.is_dir():
        print(f"Error: {books_dir} exists but is not a directory")
        sys.exit(1)

    try:
        books_path.mkdir(parents=True, exist_ok=True)
        print(f"✓ Books directory: {books_path.absolute()}")
        return books_path
    except OSError as e:
        print(f"Error: Failed to create books directory {books_dir}: {e}")
        sys.exit(1)


def migrate_book_data(source_dir: Path, target_dir: Path) -> Tuple[int, int]:
    """Migrate book data directories (_data folders)."""
    moved_count = 0
    total_size = 0

    print("\n📚 Migrating book data directories...")

    for item in source_dir.iterdir():
        if item.is_dir() and item.name.endswith("_data"):
            target_path = target_dir / item.name

            if target_path.exists():
                print(f"⚠️  Warning: Target {target_path.name} already exists, skipping...")
                continue

            try:
                # Calculate directory size
                dir_size = sum(f.stat().st_size for f in item.rglob('*') if f.is_file())

                print(f"📦 Moving: {item.name} ($(dir_size / 1024 / 1024:.1f) MB)")
                shutil.move(str(item), str(target_path))

                moved_count += 1
                total_size += dir_size
                print(f"✓ Moved {item.name}")

            except Exception as e:
                print(f"✗ Error moving {item.name}: {e}")

    return moved_count, total_size


def migrate_epub_files(source_dir: Path, target_dir: Path) -> Tuple[int, int]:
    """Migrate EPUB files to uploads directory."""
    moved_count = 0
    total_size = 0

    # Create uploads directory
    uploads_dir = Path("uploads")
    uploads_dir.mkdir(exist_ok=True)

    print("\n📄 Migrating EPUB files...")

    epub_files = list(source_dir.glob("*.epub"))
    if not epub_files:
        print("ℹ️  No EPUB files found in current directory")
        return moved_count, total_size

    for epub_file in epub_files:
        target_path = uploads_dir / epub_file.name

        if target_path.exists():
            print(f"⚠️  Warning: {epub_file.name} already exists in uploads, skipping...")
            continue

        try:
            file_size = epub_file.stat().st_size
            print(f"📖 Moving: {epub_file.name} ($(file_size / 1024 / 1024:.1f) MB)")
            shutil.move(str(epub_file), str(target_path))

            moved_count += 1
            total_size += file_size
            print(f"✓ Moved {epub_file.name}")

        except Exception as e:
            print(f"✗ Error moving {epub_file.name}: {e}")

    return moved_count, total_size


def format_size(size_bytes: int) -> str:
    """Format size in human readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


def update_env_file(books_dir: str):
    """Update or create .env file with BOOKS_DIR setting."""
    env_file = Path(".env")
    env_example = Path(".env.example")

    # If .env doesn't exist but .env.example does, copy it first
    if not env_file.exists() and env_example.exists():
        print(f"\n📝 Creating .env from .env.example...")
        shutil.copy(env_example, env_file)

    if env_file.exists():
        # Read existing content
        content = env_file.read_text() if env_file.exists() else ""
        lines = content.split('\n')

        # Update or add BOOKS_DIR
        books_line_found = False
        for i, line in enumerate(lines):
            if line.startswith('BOOKS_DIR='):
                lines[i] = f'BOOKS_DIR={books_dir}'
                books_line_found = True
                break

        if not books_line_found:
            lines.append(f'BOOKS_DIR={books_dir}')

        # Write back
        env_file.write_text('\n'.join(lines))
        print(f"✓ Updated .env file with BOOKS_DIR={books_dir}")
    else:
        # Create new .env file
        env_file.write_text(f'BOOKS_DIR={books_dir}\n')
        print(f"✓ Created .env file with BOOKS_DIR={books_dir}")


def main():
    """Main migration function."""
    print("🚀 Reader3 Book Migration Tool")
    print("=" * 40)

    # Configuration
    books_dir = os.getenv("BOOKS_DIR", "./books")
    current_dir = Path(".")

    # Validate and create books directory
    books_path = validate_books_dir(books_dir)

    # Track totals
    total_moved = 0
    total_size = 0

    # Migrate book data directories
    data_moved, data_size = migrate_book_data(current_dir, books_path)
    total_moved += data_moved
    total_size += data_size

    # Migrate EPUB files
    epub_moved, epub_size = migrate_epub_files(current_dir, books_path)
    total_moved += epub_moved
    total_size += epub_size

    # Summary
    print("\n" + "=" * 40)
    print("📊 Migration Summary:")
    print(f"   Book directories moved: {data_moved}")
    print(f"   EPUB files moved: {epub_moved}")
    print(f"   Total items moved: {total_moved}")
    print(f"   Total size: {format_size(total_size)}")

    if total_moved > 0:
        update_env_file(books_dir)
        print(f"\n🎉 Migration completed successfully!")
        print(f"   Books directory: {books_path.absolute()}")
        print(f"   Uploads directory: {Path('uploads').absolute()}")
        print(f"\n💡 Next steps:")
        print(f"   1. Review your .env file configuration")
        print(f"   2. Run './ops.sh ls' to verify the migration")
        print(f"   3. Start the server with './ops.sh dev start'")
    else:
        print("\nℹ️  No files needed to be migrated.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)