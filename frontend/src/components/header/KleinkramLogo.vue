<template>
    <div class="flex row justify-center cursor-pointer q-my-auto q-pa-none">
        <img src="/logoRSL.png" style="height: 28px" />
        <div
            class="flex column justify-center"
            style="margin-left: 12px"
            v-show="$q.screen.gt.md"
        >
            <span
                style="
                    margin-right: 30px;
                    font-weight: 600;
                    font-size: 16px;
                    line-height: 18px;
                "
            >
                Kleinkram
            </span>
            <span style="font-size: 10px; line-height: 12px"
                >by Robotics Systems Lab</span
            >
        </div>
    </div>
</template>
