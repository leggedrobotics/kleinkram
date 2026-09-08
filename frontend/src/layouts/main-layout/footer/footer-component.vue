<template>
    <footer class="app-footer text-placeholder">
        <div class="app-footer__inner">
            <div class="app-footer__group">
                <span>© {{ year }} ETH Zürich - Robotic Systems Lab (RSL)</span>
                <footer-separator class="gt-xs" />
                <span class="app-footer__build">
                    <footer-build-info />
                </span>
            </div>
            <footer-status-page-link />
        </div>
    </footer>
</template>

<script setup lang="ts">
import FooterBuildInfo from './footer-build-info.vue';
import FooterSeparator from './footer-separator.vue';
import FooterStatusPageLink from './footer-status-page-link.vue';

const year = new Date().getFullYear();
</script>

<style scoped>
.app-footer {
    border-top: 1px solid #e0e0e0;
    font-size: 12px;
    margin: 24px calc(-1 * var(--page-gutter)) 0;
    padding: 12px var(--page-gutter);
}

.app-footer__inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
}

.app-footer__group,
.app-footer__build {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
}

@media (max-width: 599px) {
    .app-footer {
        padding: 16px var(--page-gutter);
        text-align: center;
    }

    .app-footer__inner {
        flex-direction: column;
        justify-content: center;
    }

    .app-footer__group {
        flex-direction: column;
        gap: 6px;
    }

    .app-footer__build {
        justify-content: center;
    }
}
</style>
