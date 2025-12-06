# Proposal: enhance-gis-drawing-tools

## Why

The GIS drawing toolkit (Phase 0-1, 7-17) has been completed and archived. While core functionality works well, the user experience during drawing can be improved with:

1. **Real-time preview improvements** - Smoother dynamic previews during drawing operations
2. **Enhanced measurement display** - Show measurements during drawing, not just after completion
3. **More style options** - Line types (dashed, dotted), fill patterns, custom colors

These enhancements will make the drawing tools more professional and comparable to desktop GIS applications.

## What Changes

### Drawing Preview Enhancements
- Optimize CallbackProperty usage for smoother 60fps previews
- Add real-time length/area display during drawing (not just after completion)
- Improve visual feedback with cursor hints

### Line Tool Enhancements
- Add line type options: solid, dashed, dotted
- Show segment lengths during multi-point line drawing
- Display total length as user draws

### Polygon Tool Enhancements
- Show area calculation in real-time as polygon is drawn
- Add fill pattern options (solid, hatched)
- Display perimeter during drawing

### Circle/Rectangle Enhancements
- Show radius/dimensions during drag operation
- Real-time area display
- Improved visual guides

## Scope

**In Scope:**
- UI/UX improvements for existing drawing tools
- Real-time measurement display
- Additional style options

**Out of Scope:**
- 3D analysis tools (separate proposal)
- New geometry types
- Backend/persistence changes

## Affected Specs
- `platform`: Drawing tool requirements enhancement
