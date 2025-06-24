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
/* Global styles from the original style.css */
html, body {
  margin: 0;
  padding: 0;
  background-color: #000;
  color: #00ff00; /* Green text color */
  font-family: monospace;
  overflow: hidden; /* Hide scrollbars if content overflows */
  width: 100vw;
  height: 100vh;
}

/* Root div should take full viewport */
div {
  width: 100vw;
  height: 100vh;
}
</style>
