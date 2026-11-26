<script setup lang="ts">
import type { VehicleType } from '~/utils/fleet'

defineProps<{ type: VehicleType }>()

// Silhouettes instead of number plates: the vehicle size is recognisable at a glance
const SILHOUETTES: Record<VehicleType, string> = {
  Kleinwagen: '<ellipse class="sh" cx="60" cy="51" rx="50" ry="3"/><path class="k" d="M14 44 V33 Q14 28 19 27 L34 24 L45 14 Q47 12 51 12 H80 Q85 12 88 16 L99 28 Q105 30 105 35 V44 Z"/><path class="w" d="M49 16 H64 V25 H38 Z"/><path class="w" d="M68 16 H81 Q83 16 85 18 L92 25 H68 Z"/><circle class="r" cx="33" cy="44" r="7.5"/><circle class="n" cx="33" cy="44" r="2.8"/><circle class="r" cx="87" cy="44" r="7.5"/><circle class="n" cx="87" cy="44" r="2.8"/>',
  Kombi: '<ellipse class="sh" cx="61" cy="51" rx="56" ry="3"/><path class="k" d="M8 44 V33 Q8 28 13 27 L30 24 L42 14 Q44 12 48 12 H104 Q109 12 110 17 L112 28 Q114 30 114 35 V44 Z"/><path class="w" d="M46 16 H63 V25 H35 Z"/><path class="w" d="M67 16 H86 V25 H67 Z"/><path class="w" d="M90 16 H104 Q106 16 106.5 18 L108 25 H90 Z"/><circle class="r" cx="30" cy="44" r="7.5"/><circle class="n" cx="30" cy="44" r="2.8"/><circle class="r" cx="94" cy="44" r="7.5"/><circle class="n" cx="94" cy="44" r="2.8"/>',
  Transporter: '<ellipse class="sh" cx="61" cy="51" rx="56" ry="3"/><path class="k" d="M6 44 V33 Q6 28 11 27 L22 25 L31 11 Q33 8 37 8 H108 Q114 8 114 14 V44 Z"/><path class="w" d="M34 12 H48 V25 H25 Z"/><path class="w" d="M56 13 H80 V22 H56 Z"/><path class="s" d="M52 12 V40 M84 12 V40"/><circle class="r" cx="28" cy="44" r="7.5"/><circle class="n" cx="28" cy="44" r="2.8"/><circle class="r" cx="94" cy="44" r="7.5"/><circle class="n" cx="94" cy="44" r="2.8"/>',
  Großraumtransporter: '<ellipse class="sh" cx="61" cy="51" rx="56" ry="3"/><path class="k" d="M6 44 V34 Q6 29 11 28 L20 26 L27 13 Q29 9 34 8 L42 4 H110 Q116 4 116 10 V44 Z"/><path class="w" d="M30 13 H44 V26 H23 Z"/><path class="s" d="M50 7 V40 M88 7 V40"/><circle class="r" cx="28" cy="44" r="7.5"/><circle class="n" cx="28" cy="44" r="2.8"/><circle class="r" cx="96" cy="44" r="7.5"/><circle class="n" cx="96" cy="44" r="2.8"/>',
}
</script>

<template>
  <svg class="fzi" viewBox="0 0 120 56" aria-hidden="true" v-html="SILHOUETTES[type]" />
</template>
