---
name: covas-annotate-and-submit
description: Submit annotated images from Covas back to Codex. Use when the user is done annotating and wants to send the marked-up image, arrows, or boxes back to Codex for the next design iteration.
---

# Covas Annotate and Submit

Use this skill when the user has finished annotating and wants to submit the result back to Codex.

## Preconditions

Covas workspace must already be open. If it is not, call `covas-open-canvas` first.

## Workflow

1. Confirm with the user that the annotation is complete. If the user is not done, let them continue.

2. Instruct the user to click the **Submit** button inside the Covas widget. The widget sends the annotated image automatically via the host bridge — no additional MCP tool call is needed from the agent side.

3. After submission, call `get_covas_session_state` to confirm the session state is persisted:

   ```json
   {
     "projectDir": "<user project dir>",
     "sessionId": "default"
   }
   ```

4. Report the result to the user:
   - How many images are in the session (`imageOrder` length)
   - Whether the annotated image was successfully submitted
   - What to do next (e.g., "Codex will now generate a new image based on your annotations")

## If the session has multiple images

If `get_covas_session_state` returns multiple images in `imageOrder`, ask the user to confirm which version they are submitting. If submitting a specific image, switch to it first using the thumbnail bar in the Covas widget, then submit.

## Constraints

- Do not submit programmatically without the user's confirmation.
- The widget handles the `submit_covas_annotation` call internally via the host bridge. Do not manually invoke it from the skill unless the user explicitly requests a scripted submit.
- If the Covas widget is not responding or the submit button is not visible, check that the MCP server is running (`scripts/start-mcp.mjs`) and the plugin is correctly installed.
