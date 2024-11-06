<template>
    <q-btn flat color="white" class="q-pa-none">
        <header-create-new-button />

        <q-menu auto-close style="width: 280px">
            <q-list>
                <create-tag-type-dialog-opener>
                    <q-item clickable>
                        <q-item-section avatar>
                            <q-icon name="sym_o_sell" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Create New Tag Type</q-item-label>
                        </q-item-section>
                    </q-item>
                </create-tag-type-dialog-opener>
                <create-project-dialog-opener>
                    <q-item clickable>
                        <q-item-section avatar>
                            <q-icon name="sym_o_tactic" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Create New Project</q-item-label>
                        </q-item-section>
                    </q-item>
                </create-project-dialog-opener>
                <create-mission-dialog-opener>
                    <q-item clickable>
                        <q-item-section avatar>
                            <q-icon name="sym_o_explore" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Create New Mission</q-item-label>
                        </q-item-section>
                    </q-item>
                </create-mission-dialog-opener>
                <create-file-dialog-opener>
                    <q-item clickable>
                        <q-item-section avatar>
                            <q-icon name="sym_o_note_add" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Upload New File</q-item-label>
                        </q-item-section>
                    </q-item>
                </create-file-dialog-opener>
            </q-list>
        </q-menu>
    </q-btn>
</template>

<script setup lang="ts">
import CreateProjectDialogOpener from 'components/buttonWrapper/CreateProjectDialogOpener.vue';
import CreateMissionDialogOpener from 'components/buttonWrapper/CreateMissionDialogOpener.vue';
import CreateTagTypeDialogOpener from 'components/buttonWrapper/CreateTagTypeDialogOpener.vue';
import CreateFileDialogOpener from 'components/buttonWrapper/CreateFileDialogOpener.vue';
import HeaderCreateNewButton from 'components/header/HeaderCreateNewButton.vue';
</script>
