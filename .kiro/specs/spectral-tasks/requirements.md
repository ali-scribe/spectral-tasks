# Requirements Document

## Introduction

Spectral Tasks is a client-side gothic fantasy productivity web application built for the Kiroween 2026 Costume Contest. Users "summon" everyday tasks as restless spirits. Completing a task "releases" its spirit, and accumulated releases gradually restore a haunted manor. The supernatural theme is part of the functionality: task creation, completion, progress tracking and the manor's appearance are all expressed through the spirit metaphor.

The MVP runs entirely in the browser using React, TypeScript, Vite, CSS, LocalStorage, Vitest, React Testing Library and Lucide React. It has no authentication, backend, cloud database or paid APIs.

### Product Goals

- G1: Make everyday task management engaging through a coherent gothic spirit and manor metaphor.
- G2: Provide reliable, intuitive task management (create, edit, delete, complete, reopen, organize, search, filter).
- G3: Persist data safely in LocalStorage and recover gracefully from corrupted or unavailable storage.
- G4: Show real, derived progress through a manor that visibly restores as tasks are completed.
- G5: Be responsive, keyboard-accessible and motion-safe, and remain realistic for a solo student developer.

### Target Users

- Students who manage coursework, study sessions and deadlines.
- Individuals who want a lightweight, motivating personal task organizer without accounts or setup.

### User Stories (Summary)

| ID | User Story |
|----|-----------|
| US-1 | As a student, I want to summon a spirit by creating a task, so that I can capture what I need to do. |
| US-2 | As a user, I want to edit, delete, complete and reopen spirits, so that my list stays accurate. |
| US-3 | As a user, I want Today, Upcoming, All and Completed views, so that I can focus on what matters now. |
| US-4 | As a user, I want to search and filter spirits, so that I can find tasks quickly. |
| US-5 | As a user, I want overdue spirits to stand out, so that I do not miss deadlines. |
| US-6 | As a user, I want my data to survive refreshes and reopening, so that I can trust the app. |
| US-7 | As a user, I want a dashboard with a manor, counts and daily progress, so that I feel motivated. |
| US-8 | As a user, I want a ghost companion that reacts to my actions, so that the app feels alive. |
| US-9 | As a user, I want the manor to restore as I complete tasks, so that I see meaningful progress. |
| US-10 | As a user with accessibility needs, I want keyboard operation, readable contrast and reduced motion, so that I can use the app comfortably. |

## Glossary

- **Spectral_Tasks_App**: The complete client-side web application.
- **Spirit**: The themed representation of a Task. Creating a Task is "summoning" a Spirit.
- **Task**: A unit of work with a title and optional details, stored as a record in the Task_Store. The complete field list is defined in Requirement 13.
- **Active_Task**: A Task whose status is "active" (not completed).
- **Completed_Task**: A Task whose status is "completed". Completing a Task is "releasing" its Spirit.
- **Task_Form**: The user interface used to create or edit a Task.
- **Task_Store**: The in-memory collection of all Tasks managed by the Spectral_Tasks_App.
- **Storage_Service**: The component that reads and writes the persisted data in LocalStorage.
- **Storage_Envelope**: The persisted JSON object that the Spectral_Tasks_App writes with exactly three fields: schemaVersion, tasks and lastGoalCelebrationDate (see Requirement 13). A stored envelope may contain additional unknown properties, which are ignored when reading (see AC-PERS-02.18).
- **Schema_Version**: An integer in the Storage_Envelope identifying the persisted data format. The MVP value is 1.
- **Supported_Schema_Version**: The highest Schema_Version the Spectral_Tasks_App can read and write. The MVP value is 1.
- **Backup_Key**: A LocalStorage key, separate from the primary Storage_Envelope key, under which the Storage_Service stores a raw corrupted value.
- **Read_Only_Mode**: A state in which the Spectral_Tasks_App allows all in-memory operations but the Storage_Service performs no writes to LocalStorage. Read_Only_Mode is entered when the stored Schema_Version is greater than the Supported_Schema_Version or when the backup of corrupted data fails.
- **Task_Source**: The origin of a Task, stored in the Task field `source`. The allowed values are "user" and "demo".
- **Demo_Task**: A Task whose source is "demo".
- **User_Task**: A Task whose source is "user".
- **Last_Goal_Celebration_Date**: The Storage_Envelope field `lastGoalCelebrationDate`, a calendar date string `YYYY-MM-DD` or null, recording the most recent Local_Today on which the Daily_Goal_Celebration played or a Silent_Goal_Record was made. It is celebration metadata only.
- **Clock**: The replaceable function through which the Spectral_Tasks_App obtains the current date and time.
- **Date_Change_Check**: A recomputation of Local_Today using the Clock, followed by an update of every value derived from Local_Today and, where Daily_Progress is already at or above the Daily_Goal, a Silent_Goal_Record. A Date_Change_Check is passive reconciliation and never plays the Daily_Goal_Celebration.
- **Performance_Reference_Environment**: The environment defined in Requirement 20 against which Performance Targets are verified.
- **Category**: One of Study, Work, Personal, Health or Other.
- **Priority**: One of Low, Medium or High.
- **Due_Date**: An optional calendar date (year, month, day, no time) in the user's local time zone.
- **Local_Today**: The current calendar date in the user's local time zone.
- **Overdue_Task**: An Active_Task whose Due_Date is earlier than Local_Today.
- **View**: One of the four task lists: Today, Upcoming, All Tasks, Completed Tasks.
- **Filter_Controls**: The title search input, Category filter and Priority filter.
- **Dashboard**: The prominent area displaying the Manor, task counts, Daily_Progress and Ghost_Companion.
- **Manor**: The haunted manor illustration whose appearance is determined by the Manor_Stage.
- **Manor_Stage**: An integer from 0 to 5 derived from the number of Completed_Tasks currently present in the Task_Store, using fixed thresholds. Each stage has a name: 0 Abandoned, 1 Awakening, 2 Stirring, 3 Illuminated, 4 Restored, 5 Enchanted.
- **Daily_Goal**: The number of Tasks to complete per local day. The MVP value is 3 and is not configurable.
- **Daily_Progress**: The count of Tasks with a completion timestamp on Local_Today, compared against the Daily_Goal. Daily_Progress is always derived from completion timestamps and is never persisted.
- **Daily_Goal_Celebration**: The distinct Ghost_Companion celebration played the first time a Task completion raises Daily_Progress to the Daily_Goal on a Local_Today for which the Last_Goal_Celebration_Date is not yet equal to that Local_Today. Only a Task completion made by the user can trigger it; application initialization and passive Date_Change_Check reconciliation never play it.
- **Silent_Goal_Record**: The update of the Last_Goal_Celebration_Date (or its in-memory equivalent) to Local_Today, without playing the Daily_Goal_Celebration, when Daily_Progress is already at or above the Daily_Goal at application initialization or during a Date_Change_Check.
- **Ghost_Companion**: The animated ghost character on the Dashboard that reacts to user actions.
- **Demo_Data**: An optional, user-initiated set of sample Tasks, each with source "demo".
- **Reduced_Motion_Preference**: The operating system or browser setting `prefers-reduced-motion: reduce`.
- **Confirmation_Dialog**: A modal dialog requiring explicit user confirmation before a destructive action.

## Requirements

### Requirement 1: Create Tasks (Summon Spirits) (REQ-TASK-01)

**User Story:** As a student, I want to summon a spirit by creating a task, so that I can capture what I need to do.

#### Acceptance Criteria

1. WHEN the user submits the Task_Form with a valid title, THE Spectral_Tasks_App SHALL add a new Active_Task to the Task_Store. (AC-TASK-01.1)
2. THE Task_Form SHALL provide fields for title, description, Category, Priority, Due_Date and estimated duration. (AC-TASK-01.2)
3. WHEN the user submits the Task_Form with a title that is empty or contains only whitespace, THE Task_Form SHALL display an inline error message identifying the title field and SHALL NOT create a Task. (AC-TASK-01.3)
4. WHEN a Task is created, THE Spectral_Tasks_App SHALL assign the Task a unique identifier and a creation timestamp. (AC-TASK-01.4)
5. WHEN the user does not select a Category, THE Task_Form SHALL assign the Category "Other". (AC-TASK-01.5)
6. WHEN the user does not select a Priority, THE Task_Form SHALL assign the Priority "Medium". (AC-TASK-01.6)
7. WHEN a Task is created, THE Spectral_Tasks_App SHALL set the completion timestamp of the Task to null. (AC-TASK-01.7)
8. WHEN a Task is created successfully, THE Task_Form SHALL clear its fields and return keyboard focus to the title field. (AC-TASK-01.8)
9. WHEN a Task is created through the Task_Form, THE Spectral_Tasks_App SHALL set the Task source to "user". (AC-TASK-01.9)

### Requirement 2: Edit Tasks (REQ-TASK-02)

**User Story:** As a user, I want to edit a spirit's details, so that I can correct or update my plans.

#### Acceptance Criteria

1. WHEN the user chooses to edit a Task, THE Task_Form SHALL open pre-filled with the current values of that Task. (AC-TASK-02.1)
2. WHEN the user saves an edit with valid values, THE Spectral_Tasks_App SHALL update the Task and preserve its identifier, creation timestamp, completion timestamp and source. (AC-TASK-02.2)
3. WHEN the user saves an edit with an empty or whitespace-only title, THE Task_Form SHALL display an inline error message and SHALL retain the previously saved Task values. (AC-TASK-02.3)
4. WHEN the user cancels an edit, THE Spectral_Tasks_App SHALL discard the unsaved changes and leave the Task unchanged. (AC-TASK-02.4)
5. WHEN the user edits a Completed_Task, THE Spectral_Tasks_App SHALL keep the Task completed. (AC-TASK-02.5)
6. WHEN the user edits a Demo_Task and saves valid values, THE Spectral_Tasks_App SHALL keep the Task source "demo". (AC-TASK-02.6)

### Requirement 3: Delete Tasks (REQ-TASK-03)

**User Story:** As a user, I want to delete spirits I no longer need, so that my list stays relevant.

#### Acceptance Criteria

1. WHEN the user chooses to delete a Task, THE Spectral_Tasks_App SHALL display a Confirmation_Dialog naming the Task title. (AC-TASK-03.1)
2. WHEN the user confirms deletion, THE Spectral_Tasks_App SHALL remove the Task from the Task_Store. (AC-TASK-03.2)
3. WHEN the user cancels deletion, THE Spectral_Tasks_App SHALL keep the Task unchanged. (AC-TASK-03.3)
4. WHEN a Completed_Task is deleted, THE Spectral_Tasks_App SHALL recalculate the Manor_Stage, Daily_Progress and task counts from the remaining Tasks. (AC-TASK-03.4)

### Requirement 4: Complete and Reopen Tasks (Release Spirits) (REQ-TASK-04)

**User Story:** As a user, I want to release a spirit by completing its task and reopen it if needed, so that my list reflects reality.

#### Acceptance Criteria

1. WHEN the user completes an Active_Task, THE Spectral_Tasks_App SHALL set the Task status to "completed" and record the completion timestamp. (AC-TASK-04.1)
2. WHEN the user reopens a Completed_Task, THE Spectral_Tasks_App SHALL set the Task status to "active" and set the completion timestamp to null. (AC-TASK-04.2)
3. WHEN a Task is completed or reopened, THE Spectral_Tasks_App SHALL recalculate task counts, Daily_Progress and the Manor_Stage from the Task_Store. (AC-TASK-04.3)
4. WHEN a Task is reopened and later completed again, THE Spectral_Tasks_App SHALL record a new completion timestamp. (AC-TASK-04.4)
5. THE Spectral_Tasks_App SHALL allow the user to complete or reopen a Task using a single control on the Task item. (AC-TASK-04.5)
6. THE Spectral_Tasks_App SHALL allow a Demo_Task to be completed and reopened in the same way as a User_Task. (AC-TASK-04.6)

### Requirement 5: Task Views (REQ-ORG-01)

**User Story:** As a user, I want Today, Upcoming, All and Completed views, so that I can focus on what matters now.

#### Acceptance Criteria

1. THE Spectral_Tasks_App SHALL provide the Views Today, Upcoming, All Tasks and Completed Tasks. (AC-ORG-01.1)
2. THE Today View SHALL list every Active_Task whose Due_Date is Local_Today or earlier than Local_Today. (AC-ORG-01.2)
3. THE Upcoming View SHALL list every Active_Task whose Due_Date is later than Local_Today. (AC-ORG-01.3)
4. THE All Tasks View SHALL list every Active_Task, including Active_Tasks without a Due_Date. (AC-ORG-01.4)
5. THE Completed Tasks View SHALL list every Completed_Task ordered by completion timestamp, most recent first. (AC-ORG-01.5)
6. WHEN the user selects a View, THE Spectral_Tasks_App SHALL display that View and indicate it as the current View. (AC-ORG-01.6)
7. WHEN a View contains no Tasks, THE Spectral_Tasks_App SHALL display a themed empty-state message specific to that View. (AC-ORG-01.7)
8. THE Spectral_Tasks_App SHALL display the Today View as the default View on first load. (AC-ORG-01.8)
9. WHEN the Local_Today date changes while the application is open, THE Spectral_Tasks_App SHALL recompute the Today View, Upcoming View, overdue status, Daily_Progress and daily-goal celebration eligibility without a page reload. The detection mechanism is defined in Requirement 15. (AC-ORG-01.9)

### Requirement 6: Sorting, Search and Filtering (REQ-ORG-02)

**User Story:** As a user, I want to search and filter spirits, so that I can find tasks quickly.

#### Acceptance Criteria

1. WHEN the user types in the title search input, THE Spectral_Tasks_App SHALL show only Tasks in the current View whose title contains the search text, ignoring letter case. (AC-ORG-02.1)
2. WHEN the user selects a Category filter, THE Spectral_Tasks_App SHALL show only Tasks in the current View with that Category. (AC-ORG-02.2)
3. WHEN the user selects a Priority filter, THE Spectral_Tasks_App SHALL show only Tasks in the current View with that Priority. (AC-ORG-02.3)
4. WHEN multiple Filter_Controls are active, THE Spectral_Tasks_App SHALL show only Tasks that satisfy all active Filter_Controls. (AC-ORG-02.4)
5. THE Filter_Controls SHALL provide a single control that clears all active filters and the search text. (AC-ORG-02.5)
6. WHEN no Task matches the active Filter_Controls, THE Spectral_Tasks_App SHALL display a "no matching spirits" message that is distinct from the empty-View message. (AC-ORG-02.6)
7. THE Spectral_Tasks_App SHALL order Active_Task lists by Due_Date ascending with Tasks lacking a Due_Date last, then by Priority descending (High, Medium, Low), then by creation timestamp ascending. (AC-ORG-02.7)
8. WHEN the user changes the View, THE Spectral_Tasks_App SHALL keep the Filter_Controls values unchanged. (AC-ORG-02.8)

### Requirement 7: Overdue Indication (REQ-ORG-03)

**User Story:** As a user, I want overdue spirits to stand out, so that I do not miss deadlines.

#### Acceptance Criteria

1. WHILE a Task is an Overdue_Task, THE Spectral_Tasks_App SHALL display the Task with a distinct visual style and a text label "Overdue". (AC-ORG-03.1)
2. THE Spectral_Tasks_App SHALL convey the overdue state through text or an icon in addition to color. (AC-ORG-03.2)
3. WHEN a Task is completed, THE Spectral_Tasks_App SHALL remove the overdue indication from that Task. (AC-ORG-03.3)
4. WHEN a Task has a Due_Date equal to Local_Today, THE Spectral_Tasks_App SHALL NOT classify the Task as an Overdue_Task. (AC-ORG-03.4)
5. WHEN a Task has no Due_Date, THE Spectral_Tasks_App SHALL NOT classify the Task as an Overdue_Task. (AC-ORG-03.5)
6. WHEN a Completed_Task is reopened and its Due_Date is earlier than Local_Today, THE Spectral_Tasks_App SHALL classify the Task as an Overdue_Task. (AC-ORG-03.6)

### Requirement 8: Persistence in LocalStorage (REQ-PERS-01)

**User Story:** As a user, I want my data to survive refreshes and reopening, so that I can trust the app.

#### Acceptance Criteria

1. WHEN a Task is created, edited, deleted, completed or reopened, when Demo_Data is loaded or removed, or when the Last_Goal_Celebration_Date changes, THE Storage_Service SHALL write the updated Storage_Envelope to LocalStorage, except while the Spectral_Tasks_App is in Read_Only_Mode. (AC-PERS-01.1)
2. WHEN the Spectral_Tasks_App starts, THE Storage_Service SHALL read the Storage_Envelope from LocalStorage and load the stored Tasks into the Task_Store. (AC-PERS-01.2)
3. THE Storage_Envelope SHALL contain the fields schemaVersion, tasks and lastGoalCelebrationDate. (AC-PERS-01.3)
4. THE Storage_Service SHALL use one fixed, namespaced LocalStorage key for the Storage_Envelope. (AC-PERS-01.4)
5. FOR ALL valid Task_Stores and valid Last_Goal_Celebration_Date values, serializing to a Storage_Envelope then parsing and validating SHALL produce an equivalent Task_Store and an equal Last_Goal_Celebration_Date (round-trip property). (AC-PERS-01.5)
6. WHEN no Storage_Envelope exists in LocalStorage, THE Spectral_Tasks_App SHALL start with an empty Task_Store, a null Last_Goal_Celebration_Date and the welcoming empty state. (AC-PERS-01.6)
7. THE Spectral_Tasks_App SHALL persist only the Tasks, the Schema_Version and the Last_Goal_Celebration_Date, and SHALL derive Manor_Stage, Daily_Progress and task counts from the Task_Store at render time. (AC-PERS-01.7)

### Requirement 9: Stored Data Validation and Failure Handling (REQ-PERS-02)

**User Story:** As a user, I want the app to cope with broken or unavailable storage, so that I never see a blank or crashed screen.

#### Acceptance Criteria

1. WHEN the stored value is not valid JSON, THE Storage_Service SHALL treat the stored data as corrupted and start with an empty Task_Store. (AC-PERS-02.1)
2. WHEN the stored value is valid JSON but does not match the Storage_Envelope structure, THE Storage_Service SHALL treat the stored data as corrupted. (AC-PERS-02.2)
3. IF stored data is corrupted, THEN THE Spectral_Tasks_App SHALL display a dismissible notice explaining that saved data could not be read. (AC-PERS-02.3)
4. IF stored data is corrupted, THEN THE Storage_Service SHALL perform recovery in exactly this order: (1) read the original primary value; (2) detect the corruption; (3) write the exact raw corrupted value to the Backup_Key; (4) confirm that the backup write succeeded; (5) only then replace the primary value with a valid empty Storage_Envelope; (6) continue normal operation. The Storage_Service SHALL leave the original primary value unchanged until step 5. (AC-PERS-02.4)
5. WHEN an individual stored Task fails validation but the Storage_Envelope is otherwise valid, THE Storage_Service SHALL discard only the invalid Task, keep the valid Tasks and display a notice stating the number of discarded Tasks. (AC-PERS-02.5)
6. IF the stored Schema_Version is an integer greater than the Supported_Schema_Version, THEN THE Spectral_Tasks_App SHALL enter Read_Only_Mode, the Storage_Service SHALL perform no write to the primary key or the Backup_Key, and the Spectral_Tasks_App SHALL display a persistent notice that the data was created by a newer version and that changes will not be saved. (AC-PERS-02.6)
7. WHERE the stored Schema_Version is an integer lower than the Supported_Schema_Version, THE Storage_Service SHALL migrate the data to the Supported_Schema_Version through a version-keyed chain of migration functions before loading. (AC-PERS-02.7)
8. IF LocalStorage is unavailable for reading or writing, THEN THE Spectral_Tasks_App SHALL continue operating in memory and display a persistent notice that changes will not be saved. (AC-PERS-02.8)
9. IF a write to LocalStorage fails because the storage quota is exceeded, THEN THE Spectral_Tasks_App SHALL keep the change in memory and display an error notice. (AC-PERS-02.9)
10. THE Storage_Service SHALL NOT throw an unhandled exception for any value stored under its key. (AC-PERS-02.10)
11. THE Storage_Service SHALL validate the stored envelope before loading any Task, and SHALL treat the stored data as corrupted unless the envelope is a JSON object, schemaVersion is an integer greater than or equal to 1 (either a Supported_Schema_Version or lower, or a greater integer handled by AC-PERS-02.6), and tasks is an array. (AC-PERS-02.11)
12. WHEN the stored lastGoalCelebrationDate is missing, is not a string, or is not a real calendar date in the format `YYYY-MM-DD`, THE Storage_Service SHALL treat the Last_Goal_Celebration_Date as null and SHALL keep all valid Tasks without counting the value as a discarded Task. (AC-PERS-02.12)
13. WHEN a stored Task has a missing source or a source other than "user" or "demo", THE Storage_Service SHALL discard that Task as invalid and count it among the discarded Tasks. Schema_Version 1 is the first released format, so no earlier format exists from which a source could be inferred. (AC-PERS-02.13)
14. WHEN a stored Task fails any field rule of Requirement 13 or duplicates the id of an earlier stored Task, THE Storage_Service SHALL discard that Task as invalid. (AC-PERS-02.14)
15. IF the Backup_Key write in step 3 of AC-PERS-02.4 fails, THEN THE Spectral_Tasks_App SHALL leave the original primary value untouched, enter Read_Only_Mode, start with an empty in-memory Task_Store, allow in-memory operations, perform no write to LocalStorage and display a persistent notice that saved data could not be read or backed up and that changes will not be saved. (AC-PERS-02.15)
16. THE Storage_Service SHALL write the primary key only after the load attempt has finished and, for corrupted data, only after step 4 of AC-PERS-02.4, so that a failed or skipped load never replaces stored data with an empty Task_Store. (AC-PERS-02.16)
17. THE Storage_Service SHALL keep one migration function per Schema_Version step in a single registry, and the registry SHALL contain no entries while the Supported_Schema_Version is 1. (AC-PERS-02.17)
18. WHEN a stored envelope is a valid Storage_Envelope and contains properties other than schemaVersion, tasks and lastGoalCelebrationDate, THE Storage_Service SHALL ignore those unknown properties when reading, SHALL NOT treat them as corruption, and SHALL write only the three supported fields schemaVersion, tasks and lastGoalCelebrationDate. While the Spectral_Tasks_App is in Read_Only_Mode, including for a newer-version envelope under AC-PERS-02.6, the Storage_Service SHALL write nothing at all. (AC-PERS-02.18)
19. WHEN a stored Task record contains properties other than the fields defined in AC-DATA-01.1, THE Storage_Service SHALL ignore those unknown properties, omit them when writing, and continue to apply every required-field, type and value rule of AC-PERS-02.14 and Requirement 13 to the supported fields without relaxation. (AC-PERS-02.19)

### Requirement 10: Haunted Dashboard (REQ-DASH-01)

**User Story:** As a user, I want a dashboard showing my manor and progress, so that I feel motivated.

#### Acceptance Criteria

1. THE Dashboard SHALL display the Manor, the Active_Task count, the Completed_Task count, the Daily_Progress and the Ghost_Companion. (AC-DASH-01.1)
2. THE Dashboard SHALL be visible at the top of the main screen without requiring navigation to another View. (AC-DASH-01.2)
3. THE Dashboard SHALL display Daily_Progress as "completed today of Daily_Goal" in text together with a progress indicator. (AC-DASH-01.3)
4. WHEN the Task_Store changes, THE Dashboard SHALL update all counts and Daily_Progress within the same user interaction. (AC-DASH-01.4)
5. WHILE the Task_Store contains zero Tasks, THE Dashboard SHALL display a welcoming empty state that invites the user to summon the first spirit. (AC-DASH-01.5)
6. WHILE the Task_Store contains zero Tasks, THE Dashboard SHALL offer a control to load Demo_Data. (AC-DASH-01.6)
7. WHEN the user loads Demo_Data, THE Spectral_Tasks_App SHALL add the sample Tasks to the Task_Store with source "demo", as Tasks that can be edited, completed, reopened and deleted. (AC-DASH-01.7)
8. THE Spectral_Tasks_App SHALL generate Demo_Data Due_Dates relative to Local_Today. (AC-DASH-01.8)
9. WHILE the Task_Store contains at least one Demo_Task, THE Spectral_Tasks_App SHALL provide a control to remove Demo_Data, and WHEN the user confirms through a Confirmation_Dialog, THE Spectral_Tasks_App SHALL remove every Task with source "demo" and no Task with source "user". (AC-DASH-01.9)
10. THE Dashboard SHALL count Daily_Progress using the Local_Today calendar date of each completion timestamp. (AC-DASH-01.10)
11. THE Spectral_Tasks_App SHALL identify Demo_Tasks only by the source field and SHALL NOT use the title or any other field to decide whether a Task is a Demo_Task. (AC-DASH-01.11)
12. THE Spectral_Tasks_App SHALL count Demo_Tasks and User_Tasks equally for task counts, Daily_Progress and Manor_Stage. (AC-DASH-01.12)

### Requirement 11: Ghost Companion Interactions (REQ-GHOST-01)

**User Story:** As a user, I want a ghost companion that reacts to my actions, so that the app feels alive.

#### Acceptance Criteria

1. WHEN a Task is created, THE Ghost_Companion SHALL play a summoning reaction and display a short message. (AC-GHOST-01.1)
2. WHEN a Task is completed and the completion does not trigger the Daily_Goal_Celebration under AC-GHOST-01.3, THE Ghost_Companion SHALL play a celebration reaction and display a short message. (AC-GHOST-01.2)
3. WHEN a Task completion raises the Daily_Progress to the Daily_Goal and the Last_Goal_Celebration_Date is not equal to Local_Today, THE Ghost_Companion SHALL play the Daily_Goal_Celebration and THE Spectral_Tasks_App SHALL set the Last_Goal_Celebration_Date to Local_Today. (AC-GHOST-01.3)
4. WHILE no reaction is playing, THE Ghost_Companion SHALL display an idle state. (AC-GHOST-01.4)
5. WHILE a Ghost_Companion animation is playing, THE Spectral_Tasks_App SHALL keep every Task control responsive to input. (AC-GHOST-01.5)
6. WHEN a new reaction is triggered while another is playing, THE Ghost_Companion SHALL replace the current reaction with the new one. (AC-GHOST-01.6)
7. WHEN a Task is reopened or deleted, THE Ghost_Companion SHALL NOT play a celebration reaction. (AC-GHOST-01.7)
8. WHEN the Daily_Progress drops below the Daily_Goal because a Task is reopened or deleted and later reaches the Daily_Goal again while the Last_Goal_Celebration_Date equals Local_Today, THE Ghost_Companion SHALL NOT play the Daily_Goal_Celebration again. (AC-GHOST-01.8)
9. THE Ghost_Companion messages SHALL be available as text and announced to assistive technology through a polite live region. (AC-GHOST-01.9)
10. WHEN the Spectral_Tasks_App loads or performs a Date_Change_Check and the Daily_Progress is at or above the Daily_Goal, THE Spectral_Tasks_App SHALL perform a Silent_Goal_Record without playing the Daily_Goal_Celebration, and THE Ghost_Companion SHALL remain in the idle state. This criterion applies only to Daily_Progress that existed before the current user interaction (see AC-GHOST-01.15). (AC-GHOST-01.10)
11. WHEN a Date_Change_Check detects a new Local_Today, THE Spectral_Tasks_App SHALL treat the new Local_Today as a new celebration eligibility period in which the Daily_Goal_Celebration can play once. (AC-GHOST-01.11)
12. THE Spectral_Tasks_App SHALL derive the Daily_Progress only from Task completion timestamps and SHALL use the Last_Goal_Celebration_Date only to decide whether the Daily_Goal_Celebration can play. (AC-GHOST-01.12)
13. IF the Storage_Service cannot write the Last_Goal_Celebration_Date because LocalStorage is unavailable, the quota is exceeded or the Spectral_Tasks_App is in Read_Only_Mode, THEN THE Spectral_Tasks_App SHALL keep the Last_Goal_Celebration_Date in memory for the current session and SHALL NOT play the Daily_Goal_Celebration more than once per Local_Today within that session. (AC-GHOST-01.13)
14. IF the Last_Goal_Celebration_Date could not be persisted and the page is reloaded on the same Local_Today with the Daily_Progress below the Daily_Goal, THEN THE Spectral_Tasks_App SHALL accept a repeat Daily_Goal_Celebration when the Daily_Progress next reaches the Daily_Goal. This repeat is accepted only in this degraded case. (AC-GHOST-01.14)
15. WHEN a Date_Change_Check occurs during the same user interaction as a Task completion that raises the Daily_Progress to the Daily_Goal, THE Spectral_Tasks_App SHALL evaluate AC-GHOST-01.3 for that completion using the Local_Today in effect at the completion time, and SHALL NOT let the Date_Change_Check perform a Silent_Goal_Record that suppresses the Daily_Goal_Celebration. (AC-GHOST-01.15)
16. WHEN a single Task completion triggers both the ordinary completion reaction of AC-GHOST-01.2 and the Daily_Goal_Celebration of AC-GHOST-01.3, THE Ghost_Companion SHALL play only the Daily_Goal_Celebration and display the celebration message in place of the ordinary completion message. (AC-GHOST-01.16)
17. WHEN a single Task completion triggers both the ordinary completion reaction and the Daily_Goal_Celebration, THE Spectral_Tasks_App SHALL still announce the completion of the Task through the polite live region of AC-A11Y-01.8. (AC-GHOST-01.17)
18. THE Spectral_Tasks_App SHALL apply the completion, update the Task_Store and persist the change before or independently of any Ghost_Companion animation, so that no animation delays or blocks the Task operation (see AC-GHOST-01.5 and AC-A11Y-02.6). (AC-GHOST-01.18)

### Requirement 12: Manor Progression (REQ-MANOR-01)

**User Story:** As a user, I want the manor to restore as I complete tasks, so that I see meaningful progress.

#### Acceptance Criteria

1. THE Spectral_Tasks_App SHALL compute the Manor_Stage as a pure function of the number of Completed_Tasks in the Task_Store. (AC-MANOR-01.1)
2. THE Spectral_Tasks_App SHALL map Completed_Task counts to named Manor_Stages as follows: 0 is Stage 0 "Abandoned", 1 to 4 is Stage 1 "Awakening", 5 to 9 is Stage 2 "Stirring", 10 to 19 is Stage 3 "Illuminated", 20 to 34 is Stage 4 "Restored", and 35 or more is Stage 5 "Enchanted". (AC-MANOR-01.2)
3. WHEN the Completed_Task count is 0, THE Manor SHALL be displayed at Stage 0 "Abandoned" as a ruined, dark manor. (AC-MANOR-01.3)
4. THE Manor SHALL present a visibly different appearance at each Manor_Stage. (AC-MANOR-01.4)
5. WHEN a Task is reopened or a Completed_Task is deleted and the resulting count falls below a threshold, THE Manor SHALL regress to the Manor_Stage matching the new count. (AC-MANOR-01.5)
6. WHEN the Manor_Stage increases, THE Dashboard SHALL display a message announcing the new stage. (AC-MANOR-01.6)
7. THE Dashboard SHALL display the current Manor_Stage name and the number of additional Completed_Tasks needed to reach the next stage. (AC-MANOR-01.7)
8. WHILE the Manor_Stage is 5, THE Dashboard SHALL display a message that the manor is fully restored in place of the next-stage information. (AC-MANOR-01.8)
9. FOR ALL Completed_Task counts n and m with n less than or equal to m, THE Manor_Stage for n SHALL be less than or equal to the Manor_Stage for m (monotonicity property). (AC-MANOR-01.9)
10. THE Manor SHALL provide a text alternative describing its current appearance. (AC-MANOR-01.10)
11. WHEN the Spectral_Tasks_App loads, THE Manor SHALL display the Manor_Stage derived from the loaded Tasks without playing a stage-increase announcement. (AC-MANOR-01.11)
12. THE Spectral_Tasks_App SHALL derive the Manor_Stage from the number of Completed_Tasks currently present in the Task_Store and SHALL NOT count lifetime completion events, so that reopening or deleting a Completed_Task reduces the count. (AC-MANOR-01.12)

### Requirement 13: Data Model (REQ-DATA-01)

**User Story:** As a developer, I want a precisely defined data model, so that persistence, validation and tests are consistent.

#### Acceptance Criteria

1. THE Task record SHALL contain the fields: id (non-empty string), title (string), description (string), category (Category), priority (Priority), status ("active" or "completed"), dueDate (string `YYYY-MM-DD` or null), estimatedMinutes (integer or null), source ("user" or "demo"), createdAt (ISO 8601 UTC timestamp string) and completedAt (ISO 8601 UTC timestamp string or null). (AC-DATA-01.1)
2. THE Spectral_Tasks_App SHALL keep the identifier of every Task unique within the Task_Store. (AC-DATA-01.2)
3. THE Spectral_Tasks_App SHALL keep completedAt non-null if and only if status is "completed". (AC-DATA-01.3)
4. THE Spectral_Tasks_App SHALL store Due_Date as a calendar date string without a time or time zone component. (AC-DATA-01.4)
5. THE Storage_Envelope written by the Spectral_Tasks_App SHALL contain exactly the fields: schemaVersion (integer, 1 in the MVP), tasks (array of Task records) and lastGoalCelebrationDate (string `YYYY-MM-DD` or null). (AC-DATA-01.5)
6. THE Spectral_Tasks_App SHALL define Category, Priority, Task status and Task_Source as closed sets of allowed values in the type system. (AC-DATA-01.6)
7. THE Spectral_Tasks_App SHALL set the source of a Task once at creation and SHALL keep the source unchanged by edit, completion and reopening. (AC-DATA-01.7)

### Requirement 14: Validation Rules (REQ-VAL-01)

**User Story:** As a user, I want clear validation, so that I can fix mistakes in my input.

#### Acceptance Criteria

1. THE Task_Form SHALL trim leading and trailing whitespace from the title before validating and saving. (AC-VAL-01.1)
2. IF the trimmed title is longer than 100 characters, THEN THE Task_Form SHALL display an error message and SHALL NOT save the Task. (AC-VAL-01.2)
3. IF the description is longer than 1000 characters, THEN THE Task_Form SHALL display an error message and SHALL NOT save the Task. (AC-VAL-01.3)
4. IF the Due_Date value is not a real calendar date, THEN THE Task_Form SHALL display an error message and SHALL NOT save the Task. (AC-VAL-01.4)
5. IF the estimated duration is not a whole number from 1 to 1440 minutes, THEN THE Task_Form SHALL display an error message and SHALL NOT save the Task. (AC-VAL-01.5)
6. WHEN the user leaves the estimated duration empty, THE Task_Form SHALL store the estimated duration as null. (AC-VAL-01.6)
7. WHEN the user leaves the Due_Date empty, THE Task_Form SHALL store the Due_Date as null. (AC-VAL-01.7)
8. WHERE the user selects a Due_Date earlier than Local_Today for a new Task, THE Task_Form SHALL accept the Due_Date and save the Task as an Overdue_Task. (AC-VAL-01.8)
9. THE Task_Form SHALL associate each error message with its field programmatically and display a visible label for every field. (AC-VAL-01.9)
10. WHEN validation fails on submit, THE Task_Form SHALL move keyboard focus to the first invalid field. (AC-VAL-01.10)
11. WHEN the user corrects an invalid field, THE Task_Form SHALL remove the error message for that field. (AC-VAL-01.11)

### Requirement 15: Local-Calendar Date Handling (REQ-DATE-01)

**User Story:** As a user, I want dates to follow my local calendar, so that "today" and "overdue" are always correct.

#### Acceptance Criteria

1. THE Spectral_Tasks_App SHALL determine Local_Today using the local time zone of the browser. (AC-DATE-01.1)
2. THE Spectral_Tasks_App SHALL compare Due_Dates and Local_Today as calendar dates without time-of-day or UTC conversion. (AC-DATE-01.2)
3. THE Spectral_Tasks_App SHALL determine whether a completion timestamp falls on Local_Today by converting the timestamp to a local calendar date. (AC-DATE-01.3)
4. WHEN a Task is completed between 00:00 and 00:59 local time, THE Spectral_Tasks_App SHALL count the completion toward the local calendar day on which it occurred. (AC-DATE-01.4)
5. THE Spectral_Tasks_App SHALL obtain the current date through a replaceable clock function so that tests can set a fixed date. (AC-DATE-01.5)
6. THE Spectral_Tasks_App SHALL display Due_Dates in a human-readable local format. (AC-DATE-01.6)
7. WHERE the browser time zone or daylight saving offset changes between sessions, THE Spectral_Tasks_App SHALL display Due_Dates unchanged. (AC-DATE-01.7)
8. WHEN the document becomes visible, THE Spectral_Tasks_App SHALL perform a Date_Change_Check. (AC-DATE-01.8)
9. WHEN the browser window gains focus, THE Spectral_Tasks_App SHALL perform a Date_Change_Check. (AC-DATE-01.9)
10. WHILE the Spectral_Tasks_App is open, THE Spectral_Tasks_App SHALL keep one timer scheduled for the next local midnight, and WHEN the timer fires, THE Spectral_Tasks_App SHALL perform a Date_Change_Check and schedule the next timer. (AC-DATE-01.10)
11. WHEN a Date_Change_Check finds that Local_Today differs from the previously known Local_Today, THE Spectral_Tasks_App SHALL update the Today View, Upcoming View, overdue status, Daily_Progress and daily-goal celebration eligibility without a page reload, and SHALL NOT play the Daily_Goal_Celebration (see AC-GHOST-01.10 and AC-GHOST-01.15). (AC-DATE-01.11)
12. THE Spectral_Tasks_App SHALL perform every Date_Change_Check calculation and schedule the midnight timer using the Clock, so that tests can verify date changes with a fixed or advancing Clock. (AC-DATE-01.12)
13. THE Spectral_Tasks_App SHALL detect date changes only through the events and timer defined in AC-DATE-01.8 to AC-DATE-01.10 and SHALL NOT poll at a fixed interval. (AC-DATE-01.13)

### Requirement 16: Responsive Layout (REQ-RESP-01)

**User Story:** As a user, I want the app to work on desktop and mobile, so that I can use it on any device.

#### Acceptance Criteria

1. THE Spectral_Tasks_App SHALL provide a usable layout for viewport widths from 320 CSS pixels to 1920 CSS pixels. (AC-RESP-01.1)
2. THE Spectral_Tasks_App SHALL display content without horizontal scrolling at viewport widths of 320 CSS pixels and wider. (AC-RESP-01.2)
3. WHILE the viewport width is less than 768 CSS pixels, THE Spectral_Tasks_App SHALL arrange the Dashboard, Filter_Controls and task list in a single column. (AC-RESP-01.3)
4. WHILE the viewport width is 768 CSS pixels or greater, THE Spectral_Tasks_App SHALL arrange the Dashboard and the task-list area as two columns side by side, or in an equivalent arrangement in which both are at least partly visible in the initial viewport. (AC-RESP-01.4)
5. THE Spectral_Tasks_App SHALL size interactive controls to a minimum target of 44 by 44 CSS pixels on touch viewports narrower than 768 CSS pixels. (AC-RESP-01.5)
6. WHEN the user zooms the page to 200 percent, THE Spectral_Tasks_App SHALL keep all functionality available. (AC-RESP-01.6)
7. WHEN the viewport is 1024 by 768 CSS pixels and the page is scrolled to the top, THE Spectral_Tasks_App SHALL show within the viewport the Dashboard (the Manor, the counts and the Daily_Progress), the View navigation, and either the first Task item of the current View or its empty-state message. (AC-RESP-01.7)
8. THE Spectral_Tasks_App SHALL allow the task list to extend below the initial viewport and to be reached by vertical scrolling. (AC-RESP-01.8)

### Requirement 17: Keyboard Accessibility and Semantics (REQ-A11Y-01)

**User Story:** As a user who relies on the keyboard or assistive technology, I want every feature operable and understandable, so that I can use the app independently.

#### Acceptance Criteria

1. THE Spectral_Tasks_App SHALL make every interactive control reachable and operable using the keyboard alone. (AC-A11Y-01.1)
2. THE Spectral_Tasks_App SHALL display a visible focus indicator on every focused interactive control. (AC-A11Y-01.2)
3. THE Spectral_Tasks_App SHALL provide a visible text label or an accessible name for every control, including icon-only buttons. (AC-A11Y-01.3)
4. WHILE a modal dialog is open, THE Spectral_Tasks_App SHALL keep keyboard focus within the dialog. (AC-A11Y-01.4)
5. WHEN a modal dialog closes, THE Spectral_Tasks_App SHALL return keyboard focus to the control that opened the dialog. (AC-A11Y-01.5)
6. WHEN the user presses the Escape key while a modal dialog or the edit form is open, THE Spectral_Tasks_App SHALL close it without saving changes. (AC-A11Y-01.6)
7. THE Spectral_Tasks_App SHALL use semantic HTML landmarks and heading levels to structure the page. (AC-A11Y-01.7)
8. WHEN a Task is created, edited, completed, reopened or deleted, THE Spectral_Tasks_App SHALL announce the result to assistive technology through a polite live region. (AC-A11Y-01.8)
9. THE Spectral_Tasks_App SHALL NOT use color as the only means of conveying priority, category, overdue status or completion status. (AC-A11Y-01.9)
10. THE Spectral_Tasks_App SHALL provide a skip link to the main content. (AC-A11Y-01.10)

### Requirement 18: Contrast and Reduced Motion (REQ-A11Y-02)

**User Story:** As a user with visual or vestibular sensitivities, I want readable colors and calm motion options, so that the gothic theme remains comfortable.

#### Acceptance Criteria

1. THE Spectral_Tasks_App SHALL present normal text with a contrast ratio of at least 4.5:1 against its background. (AC-A11Y-02.1)
2. THE Spectral_Tasks_App SHALL present large text and interface component boundaries with a contrast ratio of at least 3:1 against adjacent colors. (AC-A11Y-02.2)
3. WHILE the Reduced_Motion_Preference is active, THE Spectral_Tasks_App SHALL replace Ghost_Companion animations, Manor transitions and decorative motion with static or non-moving alternatives. (AC-A11Y-02.3)
4. WHILE the Reduced_Motion_Preference is active, THE Ghost_Companion SHALL still display its reaction messages as text. (AC-A11Y-02.4)
5. THE Spectral_Tasks_App SHALL NOT use flashing content that flashes more than three times in any one-second period. (AC-A11Y-02.5)
6. THE Spectral_Tasks_App SHALL keep animations non-blocking so that no animation delays or prevents any Task operation. (AC-A11Y-02.6)

### Requirement 19: Non-Functional Quality (REQ-NFR-01)

**User Story:** As a solo developer, I want a maintainable and well-typed codebase with tests, so that I can extend and verify the app confidently.

#### Acceptance Criteria

1. THE Spectral_Tasks_App SHALL be written in TypeScript with strict type checking enabled and no use of the `any` type in application code. (AC-NFR-01.1)
2. THE Spectral_Tasks_App SHALL separate pure logic (date handling, filtering, sorting, Manor_Stage calculation, validation, storage parsing) from React components. (AC-NFR-01.2)
3. THE Spectral_Tasks_App SHALL include Vitest unit tests for all pure logic listed in AC-NFR-01.2, including Demo_Task removal by source, daily-goal celebration eligibility, Date_Change_Check logic with a fixed Clock, envelope and Task validation of valid and invalid records, envelope and Task unknown-property handling, corrupted-data recovery ordering including backup failure, and the Daily_Goal_Celebration precedence and same-interaction Date_Change_Check rules. (AC-NFR-01.3)
4. THE Spectral_Tasks_App SHALL include React Testing Library tests for task creation, editing, deletion, completion, reopening, filtering, Demo_Data loading and removal (including a User_Task whose title equals a demo title), the once-per-day Daily_Goal_Celebration, the replacement of the ordinary completion message by the Daily_Goal_Celebration with the completion still announced in the live region, a completion and Date_Change_Check in the same interaction, and the persistence-failure notices. (AC-NFR-01.4)
5. THE Spectral_Tasks_App SHALL limit runtime dependencies to React, React DOM and Lucide React, and the Spectral_Tasks_App SHALL implement unique identifier generation, date handling and validation without additional runtime packages. Development-only tooling (Vite, TypeScript, Vitest, React Testing Library) is not a runtime dependency. (AC-NFR-01.5)
6. THE Spectral_Tasks_App SHALL run entirely in the browser without network requests for application data. (AC-NFR-01.6)
9. THE Spectral_Tasks_App SHALL display a user-facing fallback message if an unexpected rendering error occurs, instead of a blank screen. (AC-NFR-01.9)
10. THE Spectral_Tasks_App SHALL support the current stable versions of Chrome, Firefox, Safari and Edge. (AC-NFR-01.10)

Note: AC-NFR-01.7 and AC-NFR-01.8 are retired identifiers, superseded by AC-PERF-01.2 and AC-PERF-01.3. They are not reused and no other criterion is renumbered.

### Requirement 20: Performance Targets (REQ-PERF-01)

**User Story:** As a solo developer, I want measurable performance targets with defined test procedures, so that I can verify responsiveness instead of assuming it.

These targets are verification goals, separate from the functional acceptance criteria above. Each target is verified by its stated procedure and recorded with the measured result. A target is not considered met until that measurement has been recorded. The retired identifiers AC-NFR-01.7 and AC-NFR-01.8 are explained in the note under Requirement 19.

#### Acceptance Criteria

1. THE Performance_Reference_Environment SHALL be defined as a production build (`vite build` output served locally) in the current stable Chrome on a laptop with at least 4 CPU cores and 8 GB of memory, with browser extensions disabled and no CPU throttling. (AC-PERF-01.1)
2. WHEN the All Tasks View displays 500 Active_Tasks and the user completes, reopens, edits or deletes one Task, THE Spectral_Tasks_App SHALL finish rendering the updated list within 200 milliseconds, measured as the median of 10 runs from the measurement start point defined in AC-PERF-01.5 to the next completed paint in the Performance_Reference_Environment. For the reopen measurement, the data set SHALL contain the one Completed_Task to be reopened in addition to the 500 Active_Tasks. (AC-PERF-01.2)
3. WHEN the Spectral_Tasks_App starts in the Performance_Reference_Environment with a stored Storage_Envelope containing 500 representative Tasks that include both Active_Tasks and Completed_Tasks, THE Spectral_Tasks_App SHALL display an interactive Dashboard within 2 seconds, measured as the median of 5 cold loads (as defined in AC-PERF-01.6) from navigation start to the first user input being handled. (AC-PERF-01.3)
4. THE Spectral_Tasks_App SHALL keep in the repository a deterministic data set generator (using a fixed seed or a fixed fixture, so that repeated runs use equivalent data) for the data sets of AC-PERF-01.2 and AC-PERF-01.3, together with a test script or documented manual procedure that records the measurements for AC-PERF-01.2 and AC-PERF-01.3. (AC-PERF-01.4)
5. THE measurement procedure SHALL define the start point of each interaction as the user input event on the control and the end point as the completed paint of the updated UI showing the new state: for completing and reopening, the click or Enter keypress on the complete or reopen control; for editing, the submit of the Task_Form save; for deleting, the confirm action in the Confirmation_Dialog. (AC-PERF-01.5)
6. THE measurement procedure SHALL perform each cold load of AC-PERF-01.3 with a cleared HTTP cache, a fresh browser profile and no extensions, and SHALL state for every recorded series whether it is a cold load or a warm load, where a warm load reuses the cache populated by a previous load. (AC-PERF-01.6)
7. THE measurement procedure SHALL record the actual hardware (CPU model, core count and memory), the operating system and the exact Chrome version used for each recorded measurement series. (AC-PERF-01.7)
8. THE targets of AC-PERF-01.2 and AC-PERF-01.3 SHALL remain verification targets, and the Spectral_Tasks_App SHALL NOT be described as meeting a target until the measured result has been recorded. (AC-PERF-01.8)

## Edge Cases and Failure Scenarios

| ID | Scenario | Expected Behavior | Related Criteria |
|----|----------|-------------------|------------------|
| EC-1 | Title contains only spaces | Submission rejected with inline error | AC-TASK-01.3, AC-VAL-01.1 |
| EC-2 | Title exactly 100 characters / 101 characters | 100 accepted, 101 rejected | AC-VAL-01.2 |
| EC-3 | Due date of February 30 entered manually | Rejected as invalid date | AC-VAL-01.4 |
| EC-4 | Due date of February 29 on a leap year | Accepted | AC-VAL-01.4, AC-DATE-01.2 |
| EC-5 | App left open past local midnight | The midnight timer, a visibility change or a focus event triggers a Date_Change_Check; Today, Upcoming, overdue, Daily_Progress and celebration eligibility recompute | AC-ORG-01.9, AC-DATE-01.8 to AC-DATE-01.11 |
| EC-6 | Task completed at 00:30 local time | Counted toward the local day of completion | AC-DATE-01.4 |
| EC-7 | Completed Task reopened that was the last one at a stage threshold | Manor regresses; no celebration plays | AC-MANOR-01.5, AC-GHOST-01.7 |
| EC-8 | Daily goal reached, a Task reopened, then completed again same day | Daily_Goal_Celebration plays only once per Local_Today, also after a page reload when the Last_Goal_Celebration_Date was persisted | AC-GHOST-01.3, AC-GHOST-01.8 |
| EC-9 | LocalStorage value is truncated JSON | Recovery follows the six-step sequence of AC-PERS-02.4: raw value backed up and the backup confirmed, then the primary value replaced with a valid empty envelope; empty store and corruption notice | AC-PERS-02.1, AC-PERS-02.3, AC-PERS-02.4 |
| EC-10 | One of ten stored Tasks has an invalid category | Nine Tasks load, one discarded, notice shown | AC-PERS-02.5 |
| EC-11 | Stored Schema_Version is newer than supported | Data left untouched, Read_Only_Mode, persistent notice, no writes | AC-PERS-02.6 |
| EC-12 | LocalStorage disabled (private mode or blocked) | App works in memory with a not-saved notice | AC-PERS-02.8 |
| EC-13 | Storage quota exceeded on write | Change kept in memory, error notice | AC-PERS-02.9 |
| EC-14 | Two browser tabs open and edited | Last write wins; no multi-tab sync in MVP (see A-6) | AC-PERS-01.1 |
| EC-15 | Duplicate Task titles | Allowed; identifiers keep Tasks distinct | AC-DATA-01.2 |
| EC-16 | Reduced motion enabled during completion | Static reaction and text message shown | AC-A11Y-02.3, AC-A11Y-02.4 |
| EC-17 | Rapid successive completions | All operations apply; latest ghost reaction replaces earlier one | AC-GHOST-01.5, AC-GHOST-01.6 |
| EC-18 | Active filters hide the only Task being edited | Edit remains possible; saved Task may leave the visible list | AC-ORG-02.4 |
| EC-19 | Loading Demo_Data when Tasks already exist | Control hidden once Tasks exist; cannot be loaded twice | AC-DASH-01.6 |
| EC-20 | Due date earlier than today when creating a Task | Accepted and shown as overdue | AC-VAL-01.8 |
| EC-21 | User creates a Task titled the same as a Demo_Task, then removes Demo_Data | Only Tasks with source "demo" are removed; the User_Task remains | AC-DASH-01.9, AC-DASH-01.11 |
| EC-22 | User edits the title of a Demo_Task, then removes Demo_Data | The edited Task keeps source "demo" and is removed | AC-TASK-02.6, AC-DATA-01.7 |
| EC-23 | Stored Task has a missing or unknown source | That Task is discarded and counted in the discarded-Tasks notice | AC-PERS-02.13 |
| EC-24 | Stored lastGoalCelebrationDate is "2026-02-30" or a number | Treated as null; all valid Tasks load; no discarded-Tasks count | AC-PERS-02.12 |
| EC-25 | App loads with 3 Tasks already completed today | No celebration; Silent_Goal_Record sets Last_Goal_Celebration_Date to Local_Today | AC-GHOST-01.10 |
| EC-26 | Goal celebrated yesterday; 3 Tasks completed today after midnight | New Local_Today; celebration plays once | AC-GHOST-01.11 |
| EC-27 | LocalStorage unavailable; goal reached, Task reopened, completed again | One celebration in the session; a repeat is accepted only after a reload in this degraded case | AC-GHOST-01.13, AC-GHOST-01.14 |
| EC-28 | Backup write of corrupted data fails (step 3 of AC-PERS-02.4) | Original primary value untouched, Read_Only_Mode, empty in-memory store, in-memory operations allowed, no LocalStorage writes, persistent notice | AC-PERS-02.4, AC-PERS-02.15 |
| EC-29 | Corrupted data found, backup succeeds and is confirmed, user adds a Task | The primary value was already replaced with a valid empty envelope in step 5; the new Task is then written as a normal change; the backup stays available | AC-PERS-02.4, AC-PERS-02.16 |
| EC-30 | Browser tab is hidden across local midnight and shown the next day | Date_Change_Check on visibility change updates all date-derived values | AC-DATE-01.8, AC-DATE-01.11 |
| EC-31 | Stored envelope has duplicate Task ids | The later duplicate is discarded | AC-PERS-02.14 |
| EC-32 | Task completion raises Daily_Progress to the Daily_Goal and a Date_Change_Check occurs in the same interaction | The Daily_Goal_Celebration plays once for the completion; the Date_Change_Check does not perform a Silent_Goal_Record that suppresses it | AC-GHOST-01.15, AC-GHOST-01.3, AC-DATE-01.11 |
| EC-33 | One completion would trigger both the ordinary completion reaction and the Daily_Goal_Celebration | Only the Daily_Goal_Celebration plays and its message replaces the ordinary message; the completion is still announced in the live region; the Task operation is not delayed | AC-GHOST-01.16, AC-GHOST-01.17, AC-GHOST-01.18 |
| EC-34 | Stored envelope or Task record contains unknown extra properties | Extra properties ignored, no corruption, no discard; only supported fields are written back; nothing is written in Read_Only_Mode | AC-PERS-02.18, AC-PERS-02.19 |

## MVP and Stretch Boundaries

### MVP Scope (Mandatory)

Requirements 1 to 20 define the MVP (Requirement 20 contains the Performance Targets to be verified): task CRUD with completion and reopening, the four Views, search and filters, overdue indication, LocalStorage persistence with validation and a schema version, the haunted Dashboard with Demo_Data, Ghost_Companion reactions, deterministic Manor progression, accessibility, responsiveness, local-calendar date handling and the stated quality targets.

### Stretch Features (Not Part of the MVP)

These features SHALL NOT be implemented until all MVP acceptance criteria are satisfied and the user approves them separately:

- ST-1: Achievements.
- ST-2: Focus Mode.
- ST-3: Weekly statistics.
- ST-4: Optional AI assistance.
- ST-5: User-configurable Daily_Goal.
- ST-6: Import and export of Tasks as a JSON file.
- ST-7: Multi-tab synchronization.

### Explicitly Excluded

AI chatbot, multiplayer, user accounts and authentication, cloud sync, backend services, social features, complex 3D environments and payments.

## Assumptions

- A-1: The Daily_Goal is fixed at 3 Tasks per local day in the MVP.
- A-2: Active Tasks without a Due_Date appear only in the All Tasks View, not in Today or Upcoming.
- A-3: The Today View includes overdue Active_Tasks so that they stay visible until resolved.
- A-4: Manor_Stage thresholds count all Completed_Tasks currently present in the Task_Store, including those completed on earlier days, but not completion events of Tasks that were since reopened or deleted (AC-MANOR-01.12).
- A-5: Demo_Tasks are identified only by the persisted Task field `source` with value "demo"; titles are never used for identification. The "clear all completed" action remains excluded from the MVP.
- A-6: Multiple open browser tabs are not synchronized in the MVP.
- A-7: The application is single-user and single-device, and displays text in English only in the MVP.
- A-8: Dark gothic styling is the only theme in the MVP.
- A-9: Estimated duration is stored in minutes.
- A-10: Task ordering within lists is automatic as defined in AC-ORG-02.7; manual drag-and-drop reordering is out of scope for the MVP.
- A-11: "Organize and prioritize active spirits" in the core experience is satisfied by Priority, Due_Date, Category and automatic ordering.
- A-12: Schema_Version 1 is the first released format. No earlier format exists, so a stored Task without a valid source is discarded rather than defaulted (AC-PERS-02.13), and the migration registry is empty (AC-PERS-02.17).
- A-13: The Last_Goal_Celebration_Date is celebration metadata. Losing it can at worst cause one repeated celebration in the degraded case described in AC-GHOST-01.14, and never changes Daily_Progress or Manor_Stage.
- A-14: Date changes are detected by visibility events, focus events and one midnight timer. A browser that suspends timers while the tab is hidden is covered by the visibility and focus checks.

## Open Questions

Settled decisions (Daily_Goal fixed at 3, source field for Demo_Tasks, undated Tasks only in All Tasks, Manor thresholds, no clear-all-completed action) are recorded as assumptions and requirements and are no longer open.

- OQ-6: Is the Manor presented as inline SVG or CSS-based art? This is a design decision deferred to the design phase.
