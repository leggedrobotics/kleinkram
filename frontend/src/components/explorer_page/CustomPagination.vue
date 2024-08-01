<template>
  <div class="custom-pagination">
    <span class="q-table__bottom-item">
      {{ startItem }} - {{ endItem }} of {{ itemCount }}
    </span>

    <q-btn
        icon="chevron_left"
        color="grey-8"
        round
        dense
        flat
        :disable="isFirstPage"
        @click="prevPage"
    />

    <q-btn
        icon="chevron_right"
        color="grey-8"
        round
        dense
        flat
        :disable="isLastPage"
        @click="nextPage"
    />
  </div>
</template>

<script>
export default {
  props: {
    page: Number,
    rowsPerPage: Number,
    nrFetched: Number
  },
  computed: {
    startItem() {
      return (this.page - 1) * this.rowsPerPage + 1;
    },
    endItem() {
      return this.isLastPage
          ? this.startItem + this.nrFetched - 1: this.page * this.rowsPerPage;
    },
    itemCount() {
      return this.isLastPage? this.endItem:  "many";
    },
    isFirstPage() {
      return this.page === 1;
    },
    isLastPage() {
      return this.nrFetched - 1 !== this.rowsPerPage
    }
  },
  methods: {
    prevPage() {
      if (!this.isFirstPage) {
        this.$emit('update:page', this.page - 1);
      }
    },
    nextPage() {
      if (!this.isLastPage) {
        console.log('nextPage');
        this.$emit('update:page', this.page + 1);
      }
    }
  }
}
</script>

<style scoped>
.custom-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
