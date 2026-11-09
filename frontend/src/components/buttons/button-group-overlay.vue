<!-- applies the appropriate spacing between buttons -->
<template>
    <div class="button-group-overlay flex justify-between">
        <div class="button-group-overlay__start flex items-center">
            <slot name="start" />
        </div>
        <div class="button-group-overlay__end flex">
            <slot name="end" />
        </div>
    </div>
</template>

<style scoped>
.button-group-overlay {
    gap: 10px;
    color: #0f62fe;
}

.button-group-overlay__start {
    gap: 10px;
    margin-left: 24px;
}

.button-group-overlay__end {
    gap: 20px;
    padding-right: 24px;
}

@media (max-width: 1023px) {
    .button-group-overlay {
        flex-wrap: wrap;
    }

    .button-group-overlay__start,
    .button-group-overlay__end {
        width: 100%;
        flex-wrap: wrap;
        margin-left: 0;
        padding: 0 16px;
        gap: 8px;
    }
}
</style>
