# Publish a new version of the extension

The user wants to publish a new release. Follow these steps in order:

## 1. Determine the new version

If the user has specified a version (e.g. `/publish v0.5.0`), use that. Otherwise, read the current version from `package.json` and ask the user what the new version should be before proceeding.

## 2. Bump version numbers

Update the version string to the new version in all three files:
- `package.json`
- `src/manifests/chrome.json`
- `src/manifests/firefox.json`

## 3. Commit the version bump

Stage only those three files and commit with the message:
```
chore: bump version to <version>
```

## 4. Tag and push

```bash
git tag <version>
git push origin main
git push origin <version>
```

## 5. Summarise changes since the last tag

Run `git log --oneline <previous-tag>..<new-tag>~1` to list the commits included in this release (excluding the version bump commit itself). Use these to draft the release notes.

## 6. Draft release notes

Follow the style used in previous releases (check with `gh release view` on the most recent tag for reference):
- Use `##` headings with emoji (🚀 Features, 🛠️ Fixes, 🧪 Tests & CI, 🧹 Chores — use whichever sections are relevant)
- Each item is a bullet point with a **Bold label:** followed by a short description

Show the draft to the user and ask for approval before publishing.

## 7. Publish the GitHub release

Once the user approves the notes:
```bash
gh release create <version> --title "<version>" --notes "<approved notes>"
```

Return the release URL when done.
