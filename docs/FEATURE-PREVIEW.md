# Notes and corner curl — review preview

This branch is a review preview. The published v1.0.1 release contains the notice
clearance patch; these larger changes have not been merged or released.

Run the local server from the README and open
`/?pdf=examples/form-and-field.pdf`. Open **Menu → Notes** to try the editor.

## Notes

- Add a note for the whole document or any page. Page buttons return to that page.
- Edit, delete, and undo the last 20 changes in the current session. Escape cancels
  editing; Ctrl/Command+Enter saves. Closing the sidebar returns focus to its menu.
- Export readable TXT or a JSON backup. Restore merges matching-document backups;
  conflicting versions remain separate notes. Undo can reverse a restore.
- Notes stay in this browser and origin. There is no account, server, or sync.
  Clearing site data removes saved notes. Export a backup before clearing data.
- If storage is denied, full, unreadable, or changed by another tab, the current
  session stays editable and exportable. A visible status explains the limitation.
- Document identity uses SHA-256 of the PDF bytes, computed only when Notes opens.
  A PDF.js fingerprint is the fallback if browser hashing is unavailable. Renaming
  the same PDF retains its notes; replacing the file with different bytes separates
  notes when hashing is available. No filenames are used as identity keys.
- Notes are plain text, up to 500 notes of 20,000 characters each per document.
  Note content is not included in sharing links, analytics, or network requests.
  This does not add draggable sticky notes or write annotations into the PDF.

## Paper rendering

A continuous WebGL mesh uses the local PDF canvases as front and back textures.
Top and bottom drags lead from opposite corners; moving vertically changes the
fold. Lighting is interpolated across the surface, with a separate curved shadow.
The mesh and shaders are original work. No reference-service code, media, fonts,
or other proprietary assets are included.

WebGL denial, shader failure, or context loss uses the existing strip renderer.
Reduced motion continues to avoid animated turns. Keyboard navigation, short-drag
cancellation, interrupted turns, and zoom/pan use the existing interaction model.
The mesh reuses one graphics context, two page textures, and a bounded drawing
buffer; it does not create one graphics context per turn.

## Review and validation

Use the original sample for top/bottom corner drags, forward/backward turns,
short-drag cancellation, zoom/pan, fullscreen, and a narrow viewport. Check Notes
with keyboard input, reload, exports/restoration, and unavailable browser storage.

The regression suite covers Chromium and WebKit in desktop and emulated phone
viewports, face orientation, context-loss recovery, storage failure, content
identity, text injection, cross-tab preservation, and focus restoration.
Physical phones and screen-reader software are not represented by these tests.

Measurements and a short screen recording accompany the draft PR. They compare
this app before and after using the same original PDF and viewports; they do not
establish a performance comparison with any third-party reader. No rendering
scheduler or cache changes were made: the baseline did not demonstrate a need.
