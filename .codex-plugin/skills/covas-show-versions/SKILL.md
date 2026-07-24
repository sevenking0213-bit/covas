---
name: covas-show-versions
description: Show and switch between image versions in the Covas workspace. Use when the user wants to see all annotated versions, compare images, or jump to a specific image by index or description.
---

# Covas Show Versions

Use this skill when the user wants to view, compare, or switch to a specific image in the Covas workspace.

## Workflow

### Step 1 — Read current session state

Call `get_covas_session_state` to get the current image list:

```json
{
  "projectDir": "<user project dir>",
  "sessionId": "default"
}
```

The response includes:
- `imageOrder: string[]` — ordered list of image IDs
- `imagesById: Record<string, ImageRecord>` — image metadata (kind, fileName, assetPath, thumbnailPath, createdAt, parentImageId)
- `activeImageId: string | null` — currently displayed image

If `exists: false`, no session exists yet — call `covas-open-canvas` instead.

### Step 2 — Interpret the user's intent

**Case A: User gave a specific target**

The user said something like "switch to image 3", "go back to the first version", or "annotate the previous image". Parse the intent:

| User says | Action |
|-----------|--------|
| "图1 / image 1 / version 1 / first" | index 0 |
| "图3 / image 3" | index 2 |
| "上一个 / previous / back" | `activeImageId`'s parent in the version tree |
| "最后一张 / latest" | last item in `imageOrder` |
| "原图 / original" | image with `parentImageId === null` |
| "基于图X的" / "child of image X" | images where `parentImageId === 'img-X'` |

Identify the target image ID from `imageOrder` and `imagesById`.

**Case B: User did not specify a target**

User said "show me the versions", "what images do we have", or "compare". Return a structured summary of all images:

- List each image with its index, kind (original/generated/edited), and creation time
- Note the parent-child relationships (version tree)
- Identify which one is currently active

### Step 3 — Navigate to the target

If a specific target was identified, call `render_covas_workspace_widget` with `bootstrap.manifest` containing the target as `activeImageId`:

```json
{
  "projectDir": "<user project dir>",
  "bootstrap": {
    "manifest": {
      "sessionId": "default",
      "activePageId": "page-main",
      "activeImageId": "<target image id>",
      "imageOrder": [...],
      "imagesById": {...},
      "pages": [{ "id": "page-main", "title": "Main" }],
      "pageStateById": {
        "page-main": { "pageId": "page-main", "activeImageId": "<target image id>", "promptDraft": "" }
      }
    }
  }
}
```

The widget will open with the target image already active.

If no specific target was identified, describe the available images to the user and ask them to pick one.

## Constraints

- Do not modify `imageOrder` or `imagesById` — these are managed by the widget.
- If the user wants to add a new image, call `covas-open-canvas` instead.
- If the session is empty or only has one image, inform the user that there is nothing to switch to yet.
