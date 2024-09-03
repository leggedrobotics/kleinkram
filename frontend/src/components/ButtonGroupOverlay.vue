<!-- applies the appropriate spacing between buttons -->
<template>
    <div class="flex justify-between" style="gap: 10px; color: #0f62fe">
        <div class="flex q-ml-lg" style="gap: 10px; align-items: center">
            <slot name="start" />
        </div>
        <div class="flex q-pr-lg" style="gap: 20px">
            <slot name="end" />
        </div>
    </div>
</template>
