# Changelog

## 1.3.1 - Scholar helper
- Added a Journal Compendium for School Curriculums.
- Fix for the "bought_at_rank" value when an Item was on dropped on a sheet.
- Fix for issue #23 "Token image does not save".
- Added English Compendiums for Field of Victory (thanks to mdosantos !).

## 1.3.0 - Foundry 0.8 Compatibility
__! Be certain to carefully back up any critical user data before installing this update !__
- Updated the System to the new version of Foundry VTT (a lot of things broke).
- NPC can now have strengths/weaknesses with all rings.
- Added "Title", "Bond", "Signature Scroll" and "Item Pattern":
  - The item types.
  - Theirs compendiums entries.
  - A new list in experience tab to not mess with school cursus.
  - Item patterns :
    - Can be dropped on another item to add the associated property.
    - To change the linked property, drop any property on the item pattern sheet.
- Added an optional "Specificity" technique type to serve as a catch-all.
- Added Mantis clan compendium entries.
- Added a "Description" in PC/NPC sheet: this field is used in limited view ("description" are public, "notes" are private).
- PC/NPC : Removed the "titles" field in social.
- NPC : Moved the "note" field in social to gain some space, and uniformize with PC.
- Fix : rnkMessage not passing on actor object for NPCs (thanks to Bragma).
- Fix : The "Crescent Moon Style" technique rank from 4 to 2.
- Fix : Drop an advancement on a PC/NPC sheet now correctly add the bonus to the Actor (ex Air +1), and the same with remove.
- QoL : RnK button is now black in chat if no actions are left in roll (new messages only).
- QoL : Added symbols legend in RnK dialog as reminder.
- QoL : Added "(x Max)" display in RnK picker for max number of dice to keep (thanks to Bragma).
- QoL : When DiceSoNice is enabled, the display of the RnK dialog is delayed by 2s before show-up.
- Others minor optimizations (ex: 20q saving multiple item at once).

## 1.2.1 - Praised be Firefox
- Fix dice swap on firefox that overflowed on the top and bottom of the RnK dialog
- Fix new items list on firefox who deformed the sheets

## 1.2.0 - Roll n Keep
- Added Roll n Keep 1st iteration !
  - Ability to Keep, Discard, Re-roll and Swap:
    - Keep: Keep the die for the next step, if it's an explosive one, automatically roll a new die
    - Discard: Self explain, do not keep this die for the next step.
    - Re-roll: Replace this die by a new roll (Usually Advantage & Disadvantage stuff). When a reroll is selected, all the dice in the current step will be tag as keep by default.
    - Swap (Face): Set a desired face for this die (Some weird techniques stuff)
  - Usage:
    - All these actions are done by drag and drop a die result into a target action
    - A colored icon symbolize the choice made on the dice
    - You can always change choices for the current step until you clic next
    - Please note all dice without choice will be discarded for the next step
  - The GM has the ability to undo choices by left-clicking in the status headers
  - Limitation: The roll need to only have L5R dice in it (no mixed regular + L5R)
- Fix image's behavior on create for all items sub classes
- Click on rings in the PC/PNC sheet now open the DicePicker with the selected ring
- Added a booster for loading compendium's core items (speed up 20Q)
- Added confirm dialog on item's deletion (Hold "ctrl" on the click, if you want to bypass it)
- Added "Sleep" & "Scene End" buttons in "GM ToolBox" (old "difficulty" box)
- Token's bar:
  - The strife bar is now displayed in red if the actor is compromised
  - Added an option, off by default, to reverse the fatigue's token bar (thanks to Jzrzmy)
- Added an option, on by default, to set the TN to 1 when the encounter type is selected (Intrigue, Duel, Skirmish or Mass battle)
- Split Techniques & Items by category in actor sheet (pc & npc) for better readability
- Armor & Weapon added in the conflict tab now set the "equipped" property by default
- Added Tabs on NPC sheets
- New styles for dice results

## 1.1.2 - One Compendium to bring them all
- Added compendiums (Thanks to Stéfano Fara for the English version !) Partial for French as PoW and CR are not translated yet
  - Shadowlands
  - Emerald Empire
  - Courts of Stone
  - Path of Waves
  - Celestial Realms
- English cleanup, thanks to Mark Zeman !
- Fix css for Spanish
- Fix js error when Advancement is not embed in a actor
- Click on a weapon show the DicePicker with the weapon skill selected
- Display Rarity in Compendiums for Items, Armors and Weapons
- Minion can now choose a stance and if they are prepared
- Other minors fix

## 1.1.1 - The Huns War
- Fix Minion initiative
- Fix textarea ninjo/giri

## 1.1.0 - Initiative first !
- Added initiative system :
  - Now use the score rule (the real one if you prefer)
  - Added global modifiers for Characters, Adversary and Minons in the combat tracker : Confrontation types, Prepared
  - Added sheet modifiers for Characters and Adversary: Prepared
  - Initiative buttons in character sheet now display the DicePicker and do the initiative roll
  - Change the actor stance on initiative roll in DicePicker
  - Note : Due to the lack of the Roll & Keep system, the score is computed with the full success score.
- Spanish real translation by Alejabar (thanks !)
- Added a GM Dialog Tool for setting global difficulty (TN) value / hidden (with DicePicker live refresh)
- Compendium now display Ring and Rank if any in list view
- DicePicker :
  - Fixed the initial display of "use a void point"
  - No free void point anymore
- PC/NPC Sheet :
  - Added a visual indicator for equipped / readied
  - Now only equipped armor / weapon will show in conflict tab, and all armors/weapons now show in inventory tab
  - Xp not in curriculum are now rounded up (down before, due to a translation error)
  - No more automation in stats for Npc (these cheaters !)
- 20Q Pushed the step3 item's limit to 20 (10 previous)
- Added System migration stuff

## 1.0.0 - First public release
- Removed the 0ds if no skill point
- Added initiative roll (only tactics for the moment)
- Change color of keikogi and add on compendium
- Machine translation for ES
- Update Translation for 1.0.0 Release
- 20Q added step 7 and 17 no point rule
- Add price icon
- Set vigilance to 1 if compromised
- Seamless update for 20Q (deleted refresh button)
- Update translation for npc + fix h1
- Update compendium : Remove accent on uppercase 1st letter

## 0.9.0 - Helper & Firefox Update
- Fix for npc note
- Chat texture and status
- Fix add void point on hidden -> only if added is check
- Add icons keikogi + 4 status for equipment
- Change background Compendium and padding on windows + Svg adjustements
- Updated weapons images
- Add new svg for weapon
- Ajustement css marging/padding and float
- Update item style for flex stretch css
- Pass for number and focus on click
- Xp, added some parseInt
- Fix for babele and properties
- Add type peculiarity in item entry
- Fix for cross-loaded French compendium
- 20Q : Scroll on top on next button
- V-Align for Vlyan pleasure !

## 0.8.0 - 20Q Polish
- 20Q better refresh, stay in same tab
- Advancement: Change the name and img according to the selection
- Fix for logo on Firefox
- Visual fix for Firefox and end 20Q edit
- Fix for no actor dice picker
- Added "add a void point" checkbox, and some fixes
- Added code fr module translation on README.md
- Babele is better in setup hook ?
- Added babele french translation into system
- Removed DicePiker bulk macro as it was unnecessary now
- Fix for Q13: "skill and disadv" OR "adv"
- Added some text for 20Q 2dn dice
- Stop some missing propagation
- Fix adv tooltip
- Fix 20Q wrong var for summary
- Added a real app fo helper/info button (dialog before)
- Added next bt in 20Q
- Fix nav 20Q for all screen
- Fix marge on sheet + fix nav on 20Q + clean imgs
- 20Q added step18 status, honor and glory for modifier
- Add BG and first style for 20Q
- Added class "roll" for roll in chat
- Some styles
- Add style for skill types checkboxes
- Add roll to global game var
- Change file to md
- Added a icon for "void point used" in chat log
- Fix for 20Q: constructCache only once
- Fix EN vigilante -> vigilance
- Update actor for using/get a void point
- Fix for rounded vigilance (now ceil instead of floor)
- 20Q added a summary
- Update Compendiums
- Fix for 20Q and some warn console for debug
- Fix img for drag n drop on compendium
- Added translation for Item and Actor combobox
- Add ronin svg + font <i> for ring and skill

## 0.7.0 - Compendiums Update
- Added (ring) and (skill) symbols
- Specific case for school_ability and mastery_ability on drop
- Added convertSymbol for item's desc and actor's notes
- Fix for "search anywhere" draggable icon
- Add ul li style for editor + Adjuste stance + marge on sheets and img
- Remove effects from template.json for tech
- Update css for item attribute
- added pack for "school_ability" and "mastery_ability" techniques
- Added school_ability and mastery_ability types for techniques
- Update on compendiums
- Fix properties description
- More text for effects in techs
- Fix for Compendium when player do not have the right to create a item
- Added some check on 20Q, and now rolls fill the form
- some fix for types and effects
- Translation for peculiarities types in sheet
- Last entries of peculiarities
- Added a img for new item
- advancements now with tabs
- Money ! it's a crime

## 0.6.0 - Item Enhancement
- fix on 20q
- tab on 20q and Hide rank 0 (initial) on progession
- Some checks on 20Q
- Added a check if this macro id is already in player hotbar
- Added shortcut for initiative rolls on conflict Tab (character only)
- Add a macro creator for dice roller
- Font modif for symbols in text
- pointer error
- Added symbols converter
- Exp with img and cap have now it s own row
- 20q again, added a refresh bt and fix css
- added check adv on drop
- Basic 20Q display
- Advancements better table display
- Some automatisations on advancements
- Some progression work, and fixed start rank level to 1
- Update Sidebar UI compendium and Letter spacing
- Fix Img width
- Quantities update, add and subtract on drop same object, or delete and qty > 1
- Make compendium droppable
- Fix for babele and props
- updated packs name (plural)
- Vlyan authored 2 weeks ago
- updated packs fix ranged weapons
- updated packs
- Fix fixed word 'Nope!' to a localized word for techniques
- status -> statut
- Added translation for npc subtype

## 0.5.0 - Testbed
- Fix last bug on items and update json for 0.5.0 Pre-Release
- fix using id for toggle
- removed "for" on label
- Update item with js expanded function
- toggle hook
- forced render true on macro
- no 20Q on observer
- check on tech type on drop
- Update item for description
- Update 0.4.0 style sheet + Clean video + Update Svg for canva error
- fix formapp constructor
- Finished styles for items and change npc svg
- limited sheet for limited rights
- 20q now working, step one yaw !
- fix weapons title
- working on 20Q drag n drop
- working on 20Q
- Item first iteration style, added item infos and value
- added raw book_reference to all items sheet
- added basics in items templates, and book_reference to all items
- added techniques type list checkboxes
- Fix for actor img not linked on token when change
- use of min/max for fatigue/strife/void point for use on token bars
- default actor bar fatigue/strife
- Colored svg for default img
- Style Npc Sheet v2 + update Charac + delete old ui and add svg
- fix npc dice roll, and with category id instead of skill id
- fix roll with new helper
- added zeni and reworking identity
- Add npc sheet template + css adjustments
- working on some parts of Sheets
- add armor item
- Update Style for sheet, item list and tab + update ui + add svg dice
- const for skills map, and raw 20 questions template
- Using formApp updateObject()
- Template and raw sheet for npc
- add color for element in chat
- Update styles for dice and Vlyan dev
- Dice picker v2 localization
- Update sheet for 100% height and make editor functional
- dialog picker v2
- modified stance internal usage checkboxes->radio
- 04/12/2020 - Add Templates Html + Gulp Sass + Css + Basic Tree and Files - mise à jour des informations de contributions - Mandar.
- 03/12/2020 - Init template and Workspace for Beginning of Great Adventure - Sasmira.