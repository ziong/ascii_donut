<template>
  <div>
    <!-- <NuxtPage /> --> <!-- We can use NuxtPage if we have pages/, or directly embed component -->
    <DonutDisplay />
  </div>
</template>

<script setup lang="ts">
// Import the component if it's not auto-imported by Nuxt (components/ are usually auto-imported)
// import DonutDisplay from '~/components/DonutDisplay.vue';

// No specific script needed here if DonutDisplay handles everything.
</script>

<style>
/* Global styles - ensure full viewport coverage */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  background-color: #000;
  color: #00ff00;
  font-family: monospace;
  overflow: hidden;
}

#__nuxt, #__layout {
  width: 100%;
  height: 100%;
}

/* Root div should take full viewport */
div {
  width: 100%;
  height: 100%;
}
</style>
