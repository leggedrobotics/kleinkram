<template>
    <!--
        The card of the sign-in style pages (login, CLI activation): a white
        card inside a 3x3 grid whose hairlines run past the card's corners.
    -->
    <div class="auth-page flex flex-center bg-grey-2">
        <div class="auth-frame">
            <div class="auth-frame-cell auth-frame-cell--top-left" />
            <div class="auth-frame-cell auth-frame-cell--top-center" />
            <div class="auth-frame-cell auth-frame-cell--top-right" />

            <div class="auth-frame-cell auth-frame-cell--middle-left" />
            <div class="auth-card">
                <slot />
            </div>
            <div class="auth-frame-cell auth-frame-cell--middle-right" />

            <div class="auth-frame-cell auth-frame-cell--bottom-left" />
            <div class="auth-frame-cell auth-frame-cell--bottom-center" />
            <div class="auth-frame-cell auth-frame-cell--bottom-right" />
        </div>
    </div>
</template>

<style scoped>
/*
 * On desktop the frame is exactly 48px + 460px + 48px wide; on narrow
 * viewports the middle column shrinks so the page never scrolls
 * horizontally.
 *
 * The page fills whatever the layout leaves above the footer instead of
 * claiming a fixed slice of the viewport, so the footer never pushes the
 * content past 100vh.
 */
.auth-page {
    flex: 1 1 auto;
    min-height: 0;
}

.auth-frame {
    border-radius: 0;
    display: grid;
    grid-template-columns: 48px minmax(0, 460px) 48px;
    grid-template-rows: 48px minmax(460px, auto) 48px;
    width: 100%;
    max-width: 556px;
}

.auth-frame-cell--top-left {
    border-bottom: 1px solid #e0e0e0;
    border-right: 1px solid #e0e0e0;
}

.auth-frame-cell--top-center {
    border-bottom: 1px solid #e0e0e0;
}

.auth-frame-cell--top-right {
    border-bottom: 1px solid #e0e0e0;
    border-left: 1px solid #e0e0e0;
}

.auth-frame-cell--middle-left {
    border-right: 1px solid #e0e0e0;
}

.auth-frame-cell--middle-right {
    border-left: 1px solid #e0e0e0;
}

.auth-frame-cell--bottom-left {
    border-top: 1px solid #e0e0e0;
    border-right: 1px solid #e0e0e0;
}

.auth-frame-cell--bottom-center {
    border-top: 1px solid #e0e0e0;
}

.auth-frame-cell--bottom-right {
    border-top: 1px solid #e0e0e0;
    border-left: 1px solid #e0e0e0;
}

.auth-card {
    align-items: center;
    background: white;
    display: flex;
    justify-content: center;
    padding: 48px;
    text-align: center;
}

@media (max-width: 599px) {
    .auth-page {
        padding: 24px 0;
    }

    .auth-frame {
        grid-template-columns: 16px minmax(0, 1fr) 16px;
        grid-template-rows: 16px auto 16px;
    }

    .auth-card {
        padding: 32px 20px;
    }
}
</style>
