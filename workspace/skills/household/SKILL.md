---
name: household
description: "Manage household information: shopping lists, family notes, and preferences."
---

# Household Management Skill

## Shopping List

### View the shopping list
`cat {baseDir}/../../lists/shopping.md`

### Add an item to the shopping list
`echo "- [ ] <item>" >> {baseDir}/../../lists/shopping.md`

### Mark an item as done
Replace `- [ ] <item>` with `- [x] <item>` in the shopping list file.

### Clear completed items
`sed -i '/- \[x\]/d' {baseDir}/../../lists/shopping.md`

## Family Notes

### Read a note
`cat {baseDir}/../../notes/<topic>.md`

### Write or update a note
Write content to `{baseDir}/../../notes/<topic>.md`

### List all notes
`ls {baseDir}/../../notes/`

## Preferences

Family preferences are stored in `{baseDir}/data/preferences.json`.
This includes dietary restrictions, school schedules, and regular appointments.
