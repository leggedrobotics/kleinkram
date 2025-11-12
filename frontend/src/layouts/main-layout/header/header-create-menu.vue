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
                            <q-item-label>Create Metadata</q-item-label>
                        </q-item-section>
                    </q-item>
                </create-tag-type-dialog-opener>
                <create-project-dialog-opener>
                    <q-item clickable>
                        <q-item-section avatar>
                            <q-icon name="sym_o_box" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Create Project</q-item-label>
                        </q-item-section>
                    </q-item>
                </create-project-dialog-opener>
                <create-mission-dialog-opener>
                    <q-item clickable>
                        <q-item-section avatar>
                            <q-icon name="sym_o_explore" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Create Mission</q-item-label>
                        </q-item-section>
                    </q-item>
                </create-mission-dialog-opener>
                <create-file-dialog-opener>
                    <q-item clickable>
                        <q-item-section avatar>
                            <q-icon name="sym_o_note_add" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Upload File</q-item-label>
                        </q-item-section>
                    </q-item>
                </create-file-dialog-opener>
            </q-list>
        </q-menu>
    </q-btn>
</template>

<script setup lang="ts">
import CreateFileDialogOpener from 'components/button-wrapper/dialog-opener-create-file.vue';
import CreateProjectDialogOpener from 'components/button-wrapper/dialog-opener-create-project.vue';
import CreateTagTypeDialogOpener from 'components/button-wrapper/dialog-opener-create-tag-type.vue';
import CreateMissionDialogOpener from 'components/button-wrapper/dilaog-opener-create-mission.vue';
import HeaderCreateNewButton from './header-create-button.vue';
</script>
