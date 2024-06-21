<template>
    <div class="flex flex-center">
        <div class="q-pa-lg">
            <div class="text-h3 text-center">
                Dataset Processing and Storage
            </div>
            <div class="text-h5 text-center q-my-md">Features</div>
            <ul class="q-list q-my-md styled-bullet-list">
                <li class="q-py-xs q-pl-md">
                    Upload a dataset as either .bag or .mcap
                </li>
                <li class="q-py-xs q-pl-md">
                    .bag files are converted automatically to .mcap
                </li>
                <li class="q-py-xs q-pl-md">
                    Supports Google Drive file / folder link
                </li>
                <li class="q-py-xs q-pl-md">
                    Metadata information is extracted from all files
                </li>
                <li class="q-py-xs q-pl-md">
                    Search datasets by topic or other metadata
                </li>
                <li class="q-py-xs q-pl-md">View dataset previews</li>
            </ul>
            <div class="text-h5 text-center q-my-md">Nomenclature</div>
            <ul class="q-list q-my-md styled-bullet-list">
                <li class="q-py-xs q-pl-md">File is a single .mcap file</li>
                <li class="q-py-xs q-pl-md">
                    Files recorded consecutively / parallely are grouped into a
                    Mission
                </li>
                <li class="q-py-xs q-pl-md">
                    Several Missions are then grouped into a Project
                </li>
                <li class="q-py-xs q-pl-md">
                    One File contains recordings of one or more Topics
                </li>
            </ul>
            <div class="text-h5 text-center q-my-md">Processing</div>
            <ul class="q-list q-my-md styled-bullet-list">
                <li class="q-py-xs q-pl-md">
                    Local upload of .mcap / .bag files
                </li>
                <ul class="q-list q-my-md styled-bullet-list">
                    <li class="q-py-xs q-pl-md">
                        The files are first uploaded to a temporary cloud
                        storage. During this they are displayed with Status
                        "Awaiting upload"
                    </li>
                    <li class="q-py-xs q-pl-md">
                        Once uploaded they have the state "Pending"
                    </li>
                    <li class="q-py-xs q-pl-md">
                        Then they are, one after the other (converted to .mcap
                        (state "Processing") and) permanently saved (state
                        "Done")
                    </li>
                    <li class="q-py-xs q-pl-md">
                        If the processing fails, they switch to state "Error"
                    </li>
                </ul>
                <li class="q-py-xs q-pl-md">Transfer from Google Drive</li>
                <ul class="q-list q-my-md styled-bullet-list">
                    <li class="q-py-xs q-pl-md">
                        The selected folder / file is directly in the state
                        "Pending"
                    </li>
                    <li class="q-py-xs q-pl-md">
                        Then they are, one after the other loaded from the drive
                        (& converted to .mcap (state "Processing") and)
                        permanently saved (state "Done")
                    </li>
                    <li class="q-py-xs q-pl-md">
                        If the processing fails, they switch to state "Error"
                    </li>
                </ul>
            </ul>
        </div>
    </div>
</template>

<script setup lang="ts"></script>
<style scoped>
.styled-bullet-list {
    list-style-type: disc; /* Bullet style */
    margin-left: 20px; /* Indent items to allow space for bullets */
}
</style>
