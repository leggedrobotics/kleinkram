<template>
    <title-section :title="accessGroup?.name">
        <template #title>
            <div class="row items-center no-wrap q-gutter-x-sm">
                <q-avatar
                    v-if="personal"
                    :size="$q.screen.xs ? '36px' : '48px'"
                    color="blue-1"
                    text-color="primary"
                >
                    <q-icon name="sym_o_person" />
                </q-avatar>
                <q-avatar
                    v-else
                    :size="$q.screen.xs ? '36px' : '48px'"
                    color="grey-2"
                    text-color="grey-8"
                >
                    <q-icon name="sym_o_group" />
                </q-avatar>
                <div
                    class="col column items-start q-ml-sm"
                    style="min-width: 0"
                >
                    <h1 class="text-h5 text-md-h3 q-ma-none ellipsis">
                        {{ accessGroup?.name ?? 'Loading...' }}
                    </h1>
                    <q-chip
                        v-if="
                            accessGroup?.type === AccessGroupType.AFFILIATION &&
                            accessGroup?.emailPattern
                        "
                        color="blue-1"
                        text-color="primary"
                        size="sm"
                        class="q-ma-none q-mt-xs"
                        style="max-width: 100%"
                    >
                        <div class="row items-center no-wrap">
                            <q-icon
                                name="sym_o_info"
                                size="16px"
                                class="q-mr-sm"
                            />
                            <span
                                class="text-weight-regular ellipsis"
                                style="font-size: 13px; min-width: 0"
                            >
                                Email:
                                <span class="text-weight-bold"
                                    >*@{{ accessGroup.emailPattern }}</span
                                >
                            </span>
                        </div>
                        <q-tooltip
                            class="bg-grey-9 text-body2"
                            :offset="[0, 8]"
                        >
                            Any user logging in with an email ending in
                            <strong>@{{ accessGroup.emailPattern }}</strong> is
                            automatically added to this group.
                        </q-tooltip>
                    </q-chip>
                </div>
            </div>
        </template>
        <template #tabs>
            <q-tabs
                v-model="tab"
                align="left"
                active-color="primary"
                dense
                class="text-grey"
            >
                <q-tab
                    v-if="!personal"
                    name="members"
                    label="Members"
                    style="color: #222"
                />
                <q-tab name="projects" label="Projects" style="color: #222" />
                <q-tab
                    v-if="!personal && currentUserCanEdit"
                    name="auditLogs"
                    label="Audit Logs"
                    style="color: #222"
                />
            </q-tabs>
        </template>
    </title-section>

    <q-tab-panels v-model="tab" class="q-mt-lg" style="background: transparent">
        <q-tab-panel name="projects">
            <div class="flex justify-between items-center q-mb-lg ag-toolbar">
                <div />
                <button-group class="ag-toolbar__actions">
                    <app-search-bar
                        v-model="search"
                        placeholder="Search"
                        class="q-mr-sm ag-toolbar__search"
                    />
                    <app-refresh-button @click="refetchOnClick" />
                    <app-create-button
                        label="Add Project"
                        @click="openAddProject"
                    />
                </button-group>
            </div>

            <q-table
                ref="tableRef"
                v-model:pagination="pagination"
                v-model:selected="selectedProjects"
                flat
                bordered
                separator="none"
                :rows="projectRows"
                :columns="projectCols as any"
                :grid="$q.screen.xs"
                selection="multiple"
                row-key="uuid"
                :filter="search"
                binary-state-sort
            >
                <!-- phones: one tappable card per project -->
                <template v-if="$q.screen.xs" #item="props">
                    <div class="col-12 q-pa-xs">
                        <q-card
                            flat
                            bordered
                            class="ag-card"
                            :class="{ 'ag-card--selected': props.selected }"
                            @click="() => rowClick(props.row.uuid)"
                        >
                            <q-card-section class="q-px-md q-py-sm">
                                <div class="row items-center no-wrap">
                                    <q-checkbox
                                        v-model="props.selected"
                                        color="grey-8"
                                        dense
                                        class="q-mr-md"
                                        aria-label="Select project"
                                        @click.stop
                                    />
                                    <div
                                        class="col column"
                                        style="min-width: 0"
                                    >
                                        <div
                                            class="text-weight-medium ellipsis"
                                        >
                                            {{ props.row.name }}
                                        </div>
                                        <div
                                            class="text-caption text-grey-7 ellipsis"
                                        >
                                            {{ props.row.description }}
                                        </div>
                                    </div>
                                    <q-btn
                                        flat
                                        round
                                        dense
                                        icon="sym_o_more_vert"
                                        unelevated
                                        color="primary"
                                        class="cursor-pointer"
                                        aria-label="Project actions"
                                        @click.stop
                                    >
                                        <q-menu auto-close>
                                            <q-list>
                                                <q-item
                                                    v-ripple
                                                    style="width: 180px"
                                                    clickable
                                                    @click="
                                                        () =>
                                                            rowClick(
                                                                props.row.uuid,
                                                            )
                                                    "
                                                >
                                                    <q-item-section>
                                                        View Project Details
                                                    </q-item-section>
                                                </q-item>

                                                <change-project-rights-dialog-opener
                                                    :project-uuid="
                                                        props.row.uuid
                                                    "
                                                    :project-access-uuid="
                                                        props.row
                                                            .project_access_uuid
                                                    "
                                                >
                                                    <q-item v-ripple clickable>
                                                        <q-item-section>
                                                            Change rights
                                                        </q-item-section>
                                                    </q-item>
                                                </change-project-rights-dialog-opener>
                                                <RemoveProjectDialogOpener
                                                    v-if="accessGroup"
                                                    :access-group="accessGroup"
                                                    :project-u-u-i-d="
                                                        props.row.uuid
                                                    "
                                                >
                                                    <q-item v-ripple clickable>
                                                        <q-item-section>
                                                            Remove
                                                        </q-item-section>
                                                    </q-item>
                                                </RemoveProjectDialogOpener>
                                            </q-list>
                                        </q-menu>
                                    </q-btn>
                                </div>
                                <div class="q-mt-sm">
                                    <q-chip
                                        dense
                                        square
                                        size="sm"
                                        color="grey-2"
                                        text-color="grey-9"
                                        class="q-ma-none"
                                    >
                                        {{
                                            AccessGroupRights[props.row.rights]
                                        }}
                                    </q-chip>
                                </div>
                            </q-card-section>
                        </q-card>
                    </div>
                </template>

                <template #no-data>
                    <div class="full-width row flex-center q-pa-xl text-grey-8">
                        <div class="text-center">
                            <q-icon
                                name="sym_o_folder_open"
                                size="64px"
                                color="grey-4"
                            />
                            <div class="text-h6 q-mt-md">
                                This group doesn't have access to any projects
                                yet.
                            </div>
                            <app-create-button
                                class="q-mt-md"
                                label="Assign Project"
                                @click="openAddProject"
                            />
                        </div>
                    </div>
                </template>
                <template #body-selection="props">
                    <q-checkbox
                        v-model="props.selected"
                        color="grey-8"
                        class="checkbox-with-hitbox"
                    />
                </template>
                <template #body-cell-project-action="props">
                    <q-td :props="props">
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_more_vert"
                            unelevated
                            color="primary"
                            class="cursor-pointer"
                            @click.stop
                        >
                            <q-menu auto-close>
                                <q-list>
                                    <q-item
                                        v-ripple
                                        style="width: 180px"
                                        clickable
                                        @click="() => rowClick(props.row.uuid)"
                                    >
                                        <q-item-section>
                                            View Project Details
                                        </q-item-section>
                                    </q-item>

                                    <change-project-rights-dialog-opener
                                        :project-uuid="props.row.uuid"
                                        :project-access-uuid="
                                            props.row.project_access_uuid
                                        "
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Change rights
                                            </q-item-section>
                                        </q-item>
                                    </change-project-rights-dialog-opener>
                                    <RemoveProjectDialogOpener
                                        v-if="accessGroup"
                                        :access-group="accessGroup"
                                        :project-u-u-i-d="props.row.uuid"
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Remove
                                            </q-item-section>
                                        </q-item>
                                    </RemoveProjectDialogOpener>
                                </q-list>
                            </q-menu>
                        </q-btn>
                    </q-td>
                </template>
            </q-table>
        </q-tab-panel>
        <q-tab-panel v-if="!personal" name="members">
            <div
                v-if="selectedUsers.length === 0"
                class="flex justify-between items-center q-mb-lg ag-toolbar"
            >
                <div />
                <button-group class="ag-toolbar__actions">
                    <app-search-bar
                        v-model="search"
                        placeholder="Search"
                        class="q-mr-sm ag-toolbar__search"
                    />
                    <app-refresh-button @click="refetchOnClick" />

                    <DialogOpenerAddUser
                        v-if="accessGroup"
                        :access-group="accessGroup"
                    >
                        <app-create-button label="Add User" />
                    </DialogOpenerAddUser>
                </button-group>
            </div>
            <div
                v-else
                class="q-py-lg selection-banner"
                style="background: #0f62fe"
            >
                <ButtonGroupOverlay>
                    <template #start>
                        <div style="margin: 0; font-size: 14pt; color: white">
                            {{ selectedUsers.length }}
                            {{ selectedUsers.length === 1 ? 'user' : 'users' }}
                            selected
                        </div>
                    </template>
                    <template #end>
                        <q-btn
                            flat
                            dense
                            padding="6px"
                            icon="sym_o_delete"
                            color="white"
                            :disable="!currentUserCanEdit"
                            @click="deleteSelectedUsers"
                        >
                            Delete
                            <q-tooltip v-if="!currentUserCanEdit">
                                You cannot edit this group
                            </q-tooltip>
                        </q-btn>
                        <q-btn
                            flat
                            dense
                            padding="6px"
                            icon="sym_o_close"
                            color="white"
                            @click="deselectUsers"
                        />
                    </template>
                </ButtonGroupOverlay>
            </div>
            <q-table
                v-model:pagination="pagination2"
                v-model:selected="selectedUsers"
                :rows="accessGroup?.memberships || []"
                :columns="activeUserCols as any"
                :grid="$q.screen.xs"
                selection="multiple"
                row-key="uuid"
                :filter="search"
                binary-state-sort
                flat
                bordered
            >
                <!-- phones: one card per member -->
                <template v-if="$q.screen.xs" #item="props">
                    <div class="col-12 q-pa-xs">
                        <q-card
                            flat
                            bordered
                            class="ag-card"
                            :class="{ 'ag-card--selected': props.selected }"
                        >
                            <q-card-section class="q-px-md q-py-sm">
                                <div class="row items-center no-wrap">
                                    <q-checkbox
                                        v-model="props.selected"
                                        color="grey-8"
                                        dense
                                        class="q-mr-md"
                                        aria-label="Select member"
                                    />
                                    <div
                                        class="col column"
                                        style="min-width: 0"
                                    >
                                        <div
                                            class="text-weight-medium ellipsis"
                                        >
                                            {{ props.row.user.name }}
                                        </div>
                                        <div
                                            class="text-caption text-grey-7 ellipsis"
                                        >
                                            {{ props.row.user.email ?? 'N/A' }}
                                        </div>
                                    </div>
                                    <q-btn
                                        flat
                                        round
                                        dense
                                        icon="sym_o_more_vert"
                                        unelevated
                                        color="primary"
                                        class="cursor-pointer"
                                        aria-label="Member actions"
                                        @click.stop
                                    >
                                        <q-menu auto-close>
                                            <q-list>
                                                <q-item
                                                    v-ripple
                                                    clickable
                                                    :disable="
                                                        !currentUserCanEdit
                                                    "
                                                    @click="
                                                        () =>
                                                            toggleUserRole(
                                                                props.row,
                                                            )
                                                    "
                                                >
                                                    <q-item-section>
                                                        {{
                                                            props.row
                                                                .canEditGroup
                                                                ? 'Demote to Member'
                                                                : 'Promote to Owner'
                                                        }}
                                                    </q-item-section>
                                                </q-item>
                                                <q-item
                                                    v-ripple
                                                    clickable
                                                    :disable="
                                                        !currentUserCanEdit
                                                    "
                                                    @click="
                                                        () =>
                                                            removeSingleUser(
                                                                props.row.user
                                                                    .uuid,
                                                            )
                                                    "
                                                >
                                                    <q-item-section>
                                                        Remove
                                                    </q-item-section>
                                                </q-item>
                                            </q-list>
                                        </q-menu>
                                    </q-btn>
                                </div>
                                <div
                                    class="row items-center q-gutter-x-sm q-mt-sm"
                                >
                                    <app-status-chip
                                        :expiration-date="
                                            props.row.expirationDate
                                        "
                                    />
                                    <q-chip
                                        dense
                                        square
                                        size="sm"
                                        color="grey-2"
                                        text-color="grey-9"
                                        class="q-ma-none"
                                    >
                                        {{
                                            props.row.canEditGroup
                                                ? 'Owner'
                                                : 'Member'
                                        }}
                                    </q-chip>
                                </div>
                                <q-btn
                                    flat
                                    dense
                                    no-caps
                                    size="sm"
                                    class="button-border q-mt-sm full-width"
                                    :class="
                                        isExpired(props.row.expirationDate)
                                            ? 'text-negative'
                                            : 'text-grey-9'
                                    "
                                    :disable="!currentUserCanEdit"
                                    icon="sym_o_date_range"
                                    :label="
                                        props.row.expirationDate
                                            ? `Valid until ${new Date(
                                                  props.row.expirationDate,
                                              ).toDateString()}`
                                            : 'Valid forever'
                                    "
                                    @click="
                                        () => openSetExpirationDialog(props.row)
                                    "
                                />
                            </q-card-section>
                        </q-card>
                    </div>
                </template>

                <template #no-data>
                    <div class="full-width row flex-center q-pa-xl text-grey-8">
                        <div class="text-center">
                            <q-icon
                                name="sym_o_group"
                                size="64px"
                                color="grey-4"
                            />
                            <div class="text-h6 q-mt-md">
                                There are no members in this group yet.
                            </div>
                            <DialogOpenerAddUser
                                v-if="accessGroup"
                                :access-group="accessGroup"
                            >
                                <app-create-button
                                    class="q-mt-md"
                                    label="Add User"
                                />
                            </DialogOpenerAddUser>
                        </div>
                    </div>
                </template>
                <template #body-selection="props">
                    <q-checkbox
                        v-model="props.selected"
                        color="grey-8"
                        class="checkbox-with-hitbox"
                    />
                </template>
                <template #body-cell-status="props">
                    <q-td :props="props">
                        <app-status-chip
                            :expiration-date="props.row.expirationDate"
                        />
                    </q-td>
                </template>
                <template #body-cell-accessValidUntil="props">
                    <q-td :props="props">
                        <q-btn
                            flat
                            dense
                            no-caps
                            class="button-border"
                            :class="
                                isExpired(props.row.expirationDate)
                                    ? 'text-negative'
                                    : 'text-grey-9'
                            "
                            :disable="!currentUserCanEdit"
                            @click="() => openSetExpirationDialog(props.row)"
                        >
                            <template #default>
                                <div class="row items-center q-px-sm">
                                    <q-icon
                                        size="xs"
                                        name="sym_o_date_range"
                                        class="q-mr-sm"
                                        :color="
                                            isExpired(props.row.expirationDate)
                                                ? 'negative'
                                                : ''
                                        "
                                    />
                                    <span
                                        :class="
                                            isExpired(props.row.expirationDate)
                                                ? 'text-negative text-bold'
                                                : ''
                                        "
                                    >
                                        {{
                                            props.row.expirationDate
                                                ? new Date(
                                                      props.row.expirationDate,
                                                  ).toDateString()
                                                : 'Never'
                                        }}
                                    </span>
                                </div>
                            </template>
                        </q-btn>
                    </q-td>
                </template>
                <template #body-cell-actions="props">
                    <q-td :props="props">
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_more_vert"
                            unelevated
                            color="primary"
                            class="cursor-pointer"
                            @click.stop
                        >
                            <q-menu auto-close>
                                <q-list>
                                    <q-item
                                        v-ripple
                                        style="width: 180px"
                                        clickable
                                        disable
                                    >
                                        <q-item-section>
                                            View Details
                                        </q-item-section>
                                        <q-tooltip>
                                            You can't view details of a user!
                                        </q-tooltip>
                                    </q-item>

                                    <q-item v-ripple clickable disabled>
                                        <q-item-section>Edit</q-item-section>
                                        <q-tooltip>
                                            You can't edit a user!
                                        </q-tooltip>
                                    </q-item>
                                    <q-item
                                        v-ripple
                                        clickable
                                        :disable="!currentUserCanEdit"
                                        @click="() => toggleUserRole(props.row)"
                                    >
                                        <q-item-section>
                                            {{
                                                props.row.canEditGroup
                                                    ? 'Demote to Member'
                                                    : 'Promote to Owner'
                                            }}
                                        </q-item-section>
                                        <q-tooltip v-if="!currentUserCanEdit">
                                            You can't edit a user!
                                        </q-tooltip>
                                    </q-item>
                                    <q-item
                                        v-ripple
                                        clickable
                                        :disable="!currentUserCanEdit"
                                        @click="
                                            () =>
                                                removeSingleUser(
                                                    props.row.user.uuid,
                                                )
                                        "
                                    >
                                        <q-item-section>Remove</q-item-section>
                                    </q-item>
                                </q-list>
                            </q-menu>
                        </q-btn>
                    </q-td>
                </template>
            </q-table>
        </q-tab-panel>
        <q-tab-panel v-if="!personal && currentUserCanEdit" name="auditLogs">
            <q-table
                flat
                bordered
                :wrap-cells="$q.screen.xs"
                :rows="auditLogs?.data || []"
                :columns="activeAuditLogCols as any"
                row-key="uuid"
                :pagination="{
                    rowsPerPage: 50,
                    sortBy: 'createdAt',
                    descending: true,
                }"
            >
                <template #no-data>
                    <div class="full-width row flex-center q-pa-xl text-grey-8">
                        <div class="text-center">
                            <q-icon
                                name="sym_o_history"
                                size="64px"
                                color="grey-4"
                            />
                            <div class="text-h6 q-mt-md">
                                No audit logs have been recorded for this group
                                yet.
                            </div>
                        </div>
                    </div>
                </template>
                <template #body-cell-createdAt="props">
                    <q-td :props="props">
                        {{ formatDate(new Date(props.row.createdAt), true) }}
                        <!-- phones: actor and type columns are folded in here -->
                        <div
                            v-if="$q.screen.xs"
                            class="text-caption text-grey-7"
                        >
                            {{ props.row.actor?.name ?? 'System' }} &middot;
                            {{ props.row.type }}
                        </div>
                    </q-td>
                </template>
                <template #body-cell-actor="props">
                    <q-td :props="props">
                        <div v-if="props.row.actor">
                            {{ props.row.actor.name }}
                        </div>
                        <div v-else class="text-grey-7 text-italic">System</div>
                    </q-td>
                </template>
                <template #body-cell-details="props">
                    <q-td :props="props">
                        <div v-if="props.row.type === 'CREATE_GROUP'">
                            <span class="text-grey-7">Created group</span>
                            <span class="text-weight-bold">{{
                                props.row.details.name
                            }}</span>
                        </div>
                        <div
                            v-else-if="props.row.type === 'ADD_USER'"
                            class="row items-center q-gutter-x-sm"
                        >
                            <span class="text-grey-7">Added user</span>
                            <span class="text-weight-bold">{{
                                props.row.details.userName ||
                                props.row.details.userUuid
                            }}</span>
                            <template
                                v-if="
                                    props.row.details.expireDate &&
                                    props.row.details.expireDate !== 'never'
                                "
                            >
                                <span class="text-grey-7">until</span>
                                <span class="text-weight-bold">{{
                                    formatDate(
                                        new Date(props.row.details.expireDate),
                                        false,
                                    )
                                }}</span>
                            </template>
                            <q-chip
                                v-if="props.row.details.canEditGroup"
                                size="sm"
                                color="grey-3"
                                text-color="grey-9"
                                icon="sym_o_admin_panel_settings"
                                class="q-ma-none q-px-sm"
                                ><span class="q-ml-sm">Admin</span></q-chip
                            >
                        </div>
                        <div
                            v-else-if="props.row.type === 'REMOVE_USER'"
                            class="row items-center q-gutter-x-sm"
                        >
                            <span class="text-grey-7">Removed users:</span>
                            <template v-if="props.row.details.affectedUsers">
                                <span
                                    v-for="(affectedUser, index) in props.row
                                        .details.affectedUsers"
                                    :key="affectedUser.uuid"
                                    class="text-weight-bold"
                                >
                                    {{ affectedUser.name
                                    }}<template
                                        v-if="
                                            Number(index) <
                                            props.row.details.affectedUsers
                                                .length -
                                                1
                                        "
                                        >,
                                    </template>
                                </span>
                            </template>
                            <template v-else>
                                <span
                                    v-for="(affectedUuid, index) in props.row
                                        .details.userUuids"
                                    :key="affectedUuid"
                                    class="text-weight-bold"
                                >
                                    {{ affectedUuid
                                    }}<template
                                        v-if="
                                            Number(index) <
                                            props.row.details.userUuids.length -
                                                1
                                        "
                                        >,
                                    </template>
                                </span>
                            </template>
                        </div>
                        <div
                            v-else-if="props.row.type === 'UPDATE_EXPIRE_DATE'"
                            class="row items-center q-gutter-x-sm"
                        >
                            <span class="text-grey-7"
                                >Updated expiration for</span
                            >
                            <span class="text-weight-bold">{{
                                props.row.details.userName ||
                                props.row.details.userUuid
                            }}</span>
                            <span class="text-grey-7">to</span>
                            <span
                                v-if="props.row.details.expireDate === 'never'"
                                class="text-weight-bold"
                                >Never</span
                            >
                            <span v-else class="text-weight-bold">{{
                                formatDate(
                                    new Date(props.row.details.expireDate),
                                    false,
                                )
                            }}</span>
                        </div>
                        <div
                            v-else-if="props.row.type === 'ADD_PROJECT'"
                            class="row items-center q-gutter-x-sm"
                        >
                            <span class="text-grey-7">Added project</span>
                            <span class="text-weight-bold">{{
                                props.row.details.projectName ||
                                props.row.details.projectUuid
                            }}</span>
                            <span class="text-grey-7">with rights</span>
                            <span class="text-weight-bold">{{
                                AccessGroupRights[props.row.details.rights]
                            }}</span>
                        </div>
                        <div
                            v-else-if="props.row.type === 'REMOVE_PROJECT'"
                            class="row items-center q-gutter-x-sm"
                        >
                            <span class="text-grey-7">Removed project</span>
                            <span class="text-weight-bold">{{
                                props.row.details.projectName ||
                                props.row.details.projectUuid
                            }}</span>
                        </div>
                        <div
                            v-else-if="
                                props.row.type === 'UPDATE_PROJECT_ACCESS'
                            "
                            class="row items-center q-gutter-x-sm"
                        >
                            <span class="text-grey-7"
                                >Updated rights for project</span
                            >
                            <span class="text-weight-bold">{{
                                props.row.details.projectName ||
                                props.row.details.projectUuid
                            }}</span>
                            <span class="text-grey-7">to</span>
                            <span class="text-weight-bold">{{
                                AccessGroupRights[props.row.details.rights]
                            }}</span>
                        </div>
                        <div
                            v-else
                            style="
                                white-space: pre-wrap;
                                font-family: monospace;
                                font-size: 0.85em;
                                color: #555;
                            "
                        >
                            {{ JSON.stringify(props.row.details, null, 2) }}
                        </div>
                    </q-td>
                </template>
            </q-table>
        </q-tab-panel>
    </q-tab-panels>
</template>
<script setup lang="ts">
import type { GroupMembershipDto } from '@kleinkram/api-dto/types/access-control/group-membership.dto';
import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import DialogOpenerAddUser from 'components/button-wrapper/dialog-opener-add-user.vue';
import ChangeProjectRightsDialogOpener from 'components/button-wrapper/dialog-opener-change-project-rights.vue';
import RemoveProjectDialogOpener from 'components/button-wrapper/remove-project-dialog-opener.vue';
import ButtonGroupOverlay from 'components/buttons/button-group-overlay.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import AppCreateButton from 'components/common/app-create-button.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import AppStatusChip from 'components/common/app-status-chip.vue';
import TitleSection from 'components/title-section.vue';
import { Notify, QTable, useQuasar } from 'quasar';
import { projectAccessColumns } from 'src/components/explorer-page/explorer-page-table-columns';
import AddProjectToAccessGroupDialog from 'src/dialogs/add-project-access-group-dialog.vue';
import SetAccessGroupExpirationDialog from 'src/dialogs/modify-membership-expiration-date-dialog.vue';
import {
    useAccessGroup,
    useAccessGroupAuditLogs,
    useUser,
} from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { formatDate, isExpired } from 'src/services/date-formating';
import {
    removeUsersFromAccessGroup,
    setAccessGroupExpiry,
    setAccessGroupUserPermissions,
} from 'src/services/mutations/access';
import { computed, ComputedRef, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const $q = useQuasar();
const router = useRouter();
const tab = ref('members');
const uuid: ComputedRef<string> = computed(
    () => router.currentRoute.value.params.uuid,
) as ComputedRef<string>;
const selectedProjects = ref([]);
const selectedUsers = ref<GroupMembershipDto[]>([]);

const search = ref('');

const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 30,
});

const pagination2 = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 30,
});

const queryClient = useQueryClient();
const user = useUser();

const refetchOnClick: (event_: Event) => void = () => void refetch();

const { data: accessGroup, refetch } = useAccessGroup(uuid.value);

const { mutate: removeUsers } = useMutation({
    mutationFn: (userUuids: string[]) =>
        removeUsersFromAccessGroup(userUuids, uuid.value),
    onSuccess: async () => {
        selectedUsers.value = [];
        await queryClient.invalidateQueries({
            queryKey: ['AccessGroup', uuid.value],
        });
        await queryClient.invalidateQueries({
            queryKey: ['AccessGroupAuditLogs', uuid.value],
        });
        Notify.create({
            message: 'User(s) removed successfully',
            color: 'positive',
            position: 'bottom',
        });
    },
    onError: () => {
        Notify.create({
            message: 'Error removing user(s) from access group',
            color: 'negative',
            position: 'bottom',
        });
    },
});

const removeSingleUser = (userUuid: string): void => {
    removeUsers([userUuid]);
};

const toggleUserRole = async (membership: GroupMembershipDto) => {
    try {
        await setAccessGroupUserPermissions(
            uuid.value,
            membership.user.uuid,
            !membership.canEditGroup,
        );
        await queryClient.invalidateQueries({
            predicate: (query) => {
                return (
                    (query.queryKey[0] === 'AccessGroup' &&
                        query.queryKey[1] === uuid.value) ||
                    (query.queryKey[0] === 'AccessGroupAuditLogs' &&
                        query.queryKey[1] === uuid.value)
                );
            },
        });
    } catch (error: unknown) {
        const message =
            (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message ?? 'Failed to update user permissions';
        Notify.create({
            message,
            color: 'negative',
            position: 'bottom',
        });
    }
};

const deleteSelectedUsers = (): void => {
    if (selectedUsers.value.length > 0) {
        removeUsers(selectedUsers.value.map((m) => m.user.uuid));
    }
};

const deselectUsers = (): void => {
    selectedUsers.value = [];
};

const personal = computed(
    () => accessGroup.value?.type === AccessGroupType.PRIMARY,
);

watch(
    () => personal.value,
    (value) => {
        if (value) {
            tab.value = 'projects';
        }
    },
    { immediate: true },
);

const projectRows = computed(() => {
    return accessGroup.value?.projectAccesses ?? [];
});

const openAddProject = (): void => {
    $q.dialog({
        component: AddProjectToAccessGroupDialog,
        componentProps: {
            accessGroupUuid: uuid.value,
        },
    });
};

const renameColumns = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cols: any[],
    oldLabel: string,
    newLabel: string,
): void => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (const col of cols.filter((c) => c.label === oldLabel)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        col.label = newLabel;
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dropColumns = (cols: any[], label: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return cols.filter((col) => col.label !== label);
};

const { mutate: setAccessGroup } = useMutation({
    mutationFn: (data: {
        uuid: string;
        userUuid: string;
        expirationDate: Date | null;
    }) => {
        return setAccessGroupExpiry(
            data.uuid,
            data.userUuid,
            data.expirationDate,
        );
    },
    onSuccess: async () => {
        await queryClient.invalidateQueries({
            predicate: (query) => {
                return (
                    (query.queryKey[0] === 'AccessGroup' &&
                        query.queryKey[1] === uuid.value) ||
                    (query.queryKey[0] === 'AccessGroupAuditLogs' &&
                        query.queryKey[1] === uuid.value)
                );
            },
        });
        Notify.create({
            message: 'Expiration date set',
            color: 'positive',
            position: 'bottom',
        });
    },
    onError: () => {
        Notify.create({
            message: 'Error setting expiration date',
            color: 'negative',
            position: 'bottom',
        });
    },
});

const openSetExpirationDialog = (agu: GroupMembershipDto): void => {
    $q.dialog({
        component: SetAccessGroupExpirationDialog,
        componentProps: {
            agu: agu,
        },
    }).onOk((expirationDate: Date | null) => {
        setAccessGroup({
            uuid: accessGroup.value?.uuid ?? '',
            userUuid: agu.user.uuid,
            expirationDate,
        });
    });
};

const projectCols = computed(() => {
    {
        let defaultCols = [...projectAccessColumns];
        renameColumns(defaultCols, 'Creator', 'Project Creator');
        renameColumns(defaultCols, 'Description', 'Project Description');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        defaultCols = dropColumns(defaultCols, 'Created');

        // add as the second to last column
        defaultCols.splice(-2, 1, {
            name: 'rights',
            required: true,
            label: 'Group Rights',
            style: 'max-width: 100px',
            align: 'left',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            field: (row: any) => AccessGroupRights[row.rights],
        });
        return defaultCols;
    }
});

const currentUserCanEdit = computed(() => {
    return (
        accessGroup.value?.memberships.some(
            (m) => m.user.uuid === user.data.value?.uuid && m.canEditGroup,
        ) ?? false
    );
});

const auditLogsQueryEnabled = computed(
    () => !personal.value && currentUserCanEdit.value,
);
const { data: auditLogs } = useAccessGroupAuditLogs(uuid, {
    enabled: auditLogsQueryEnabled,
});

const userCols = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: (row: GroupMembershipDto): string => row.user.name,
        format: (value: string): string => value,
        style: 'width: 10%',
    },
    {
        name: 'email',
        required: false,
        label: 'Email',
        align: 'left',
        field: (row: GroupMembershipDto): string => row.user.email ?? 'N/A',
        format: (value: string): string => value,
        style: 'width: 20%; color: #666',
    },
    {
        name: 'status',
        required: true,
        label: 'Status',
        align: 'left',
    },
    {
        name: 'accessValidUntil',
        required: true,
        label: 'Access Valid Until',
        align: 'left',
    },
    {
        name: 'role',
        required: true,
        label: 'Role',
        align: 'left',
        field: (row: GroupMembershipDto): string =>
            row.canEditGroup ? 'Owner' : 'Member',
    },
    {
        name: 'actions',
        required: true,
        label: '',
        align: 'center',
        field: 'actions',
        style: 'width: 5%',
    },
];

// the email column is dropped on tablets, on phones the table is replaced by
// a card list that shows the email below the name
const activeUserCols = computed(() =>
    $q.screen.sm ? userCols.filter((col) => col.name !== 'email') : userCols,
);

const rowClick = async (_uuid: string): Promise<void> => {
    await router.push({
        name: ROUTES.MISSIONS.routeName,
        params: {
            projectUuid: _uuid,
        },
    });
};

const auditLogCols = [
    {
        name: 'createdAt',
        required: true,
        label: 'Timestamp',
        align: 'left',
        field: 'createdAt',
        sortable: true,
    },
    {
        name: 'actor',
        required: true,
        label: 'Actor',
        align: 'left',
        field: (row: { actor?: { name: string } }) =>
            row.actor?.name ?? 'System',
        sortable: true,
    },
    {
        name: 'type',
        required: true,
        label: 'Action Type',
        align: 'left',
        field: 'type',
        sortable: true,
    },
    {
        name: 'details',
        required: true,
        label: 'Details',
        align: 'left',
        field: 'details',
    },
];

// on phones only the timestamp and the details fit; the actor and the action
// type are rendered below the timestamp instead
const activeAuditLogCols = computed(() =>
    $q.screen.xs
        ? auditLogCols.filter(
              (col) => col.name === 'createdAt' || col.name === 'details',
          )
        : auditLogCols,
);
</script>
<style scoped>
.button-border {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}

.ag-card--selected {
    background-color: #e7efff;
}

/* below 1024px the toolbars stack: search on its own row, buttons below */
@media (max-width: 1023px) {
    .ag-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
    }

    .ag-toolbar__actions {
        flex-wrap: wrap;
    }

    .ag-toolbar__search {
        flex: 1 0 100%;
        margin-right: 0;
    }

    .ag-toolbar :deep(.q-btn) {
        min-height: 40px;
        min-width: 40px;
    }
}

@media (max-width: 599px) {
    .selection-banner :deep(.q-ml-lg) {
        margin-left: 12px;
    }

    .selection-banner :deep(.q-pr-lg) {
        padding-right: 12px;
    }
}
</style>
