<script setup lang="ts">
// Asks before an action that can't be undone in one click (cancel a booking, deactivate an account).
// Usage: const confirmDialog = useTemplateRef('confirmDialog'); if (await confirmDialog.value!.ask({ … })) …
interface Question { title: string, text: string, confirmLabel: string, danger?: boolean }

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const question = ref<Question>({ title: '', text: '', confirmLabel: '' })
let answer: (confirmed: boolean) => void = () => {}

const ask = (next: Question) => new Promise<boolean>((resolve) => {
  question.value = next
  answer = resolve
  dialog.value!.showModal()
})
const close = (confirmed: boolean) => {
  dialog.value!.close()
  answer(confirmed)
}
defineExpose({ ask })
</script>

<template>
  <!-- Esc closes the native dialog without a click: @cancel counts that as "no" -->
  <dialog ref="dialog" class="dlg" aria-labelledby="confirm-heading" aria-describedby="confirm-text" @cancel="answer(false)">
    <div class="row" style="gap: 16px; align-items: flex-start; flex-wrap: nowrap">
      <span class="dlg-icon" :style="question.danger ? 'background: var(--rot-bg); color: var(--rot-ink)' : ''"><AppIcon name="warning" style="width: 24px; height: 24px" /></span>
      <div class="stack-s">
        <h2 id="confirm-heading">{{ question.title }}</h2>
        <p id="confirm-text" class="muted">{{ question.text }}</p>
      </div>
    </div>
    <div class="dlg-foot">
      <!-- Focus starts on "Abbrechen", so a hasty Enter doesn't confirm -->
      <button type="button" class="btn btn-s" autofocus @click="close(false)">Abbrechen</button>
      <button type="button" class="btn" :class="question.danger ? 'btn-r' : 'btn-p'" @click="close(true)">{{ question.confirmLabel }}</button>
    </div>
  </dialog>
</template>
