import Vue from 'vue'

import ListenersMixin from '../../mixins/listeners.js'

import { stopAndPrevent } from '../../utils/event.js'
import { slot } from '../../utils/slot.js'
import { addFocusFn } from '../../utils/focus-manager.js'

const noErrors = []

export default Vue.extend({
  name: 'QForm',

  mixins: [ ListenersMixin ],

  props: {
    autofocus: Boolean,
    noErrorFocus: Boolean,
    noResetFocus: Boolean,
    greedy: Boolean
  },

  computed: {
    onEvents () {
      return {
        ...this.qListeners,
        submit: this.submit,
        reset: this.reset
      }
    }
  },

  mounted () {
    this.validateIndex = 0
    this.autofocus === true && this.focus()
  },

  activated () {
    if (this.shouldActivate !== true) { return }
    this.autofocus === true && this.focus()
  },

  deactivated () {
    this.shouldActivate = true
  },

  methods: {
    validate (shouldFocus) {
      const focus = typeof shouldFocus === 'boolean'
        ? shouldFocus
        : this.noErrorFocus !== true

      const index = ++this.validateIndex

      const components = this.getValidationComponents().filter(c => c.disable !== true)

      const emit = (res, ref) => {
        this.$emit('validation-' + (res === true ? 'success' : 'error'), ref)
      }

      const validateComponent = comp => {
        if (index !== this.validateIndex || !comp) {
          return Promise.resolve({ valid: true, comp })
        }

        const valid = comp.validate()

        return typeof valid.then === 'function'
          ? valid.then(
            valid => ({ valid, comp }),
            err => ({ valid: false, comp, err })
          )
          : Promise.resolve({ valid, comp })
      }

      const errorsPromise = this.greedy === true
        ? Promise.all(components.map(validateComponent)).then(res => res.filter(r => r.valid !== true))
        : components
          .reduce((acc, comp) => acc.then(() => validateComponent(comp)
            .then(r => r.valid === true ? noErrors : Promise.reject(r))
          ), Promise.resolve(noErrors))
          .catch(error => [error])

      return errorsPromise.then(errors => {
        if (errors.length === 0) {
          index === this.validateIndex && emit(true)
          return true
        }

        if (index === this.validateIndex) {
          const { valid, comp, err } = errors[0]

          err !== void 0 && console.error(err)

          emit(false, comp)

          if (
            focus === true &&
            valid !== true &&
            comp &&
            typeof comp.focus === 'function'
          ) {
            comp.focus()
          }
        }

        return false
      })
    },

    resetValidation () {
      this.validateIndex++

      this.getValidationComponents().forEach(comp => {
        typeof comp.resetValidation === 'function' && comp.resetValidation()
      })
    },

    submit (evt) {
      evt !== void 0 && stopAndPrevent(evt)

      const index = this.validateIndex + 1

      this.validate().then(val => {
        // if not outdated && validation succeeded
        if (index === this.validateIndex && val === true) {
          if (this.qListeners.submit !== void 0) {
            this.$emit('submit', evt)
          }
          else if (evt !== void 0 && evt.target !== void 0 && typeof evt.target.submit === 'function') {
            evt.target.submit()
          }
        }
      })
    },

    reset (evt) {
      evt !== void 0 && stopAndPrevent(evt)

      this.$emit('reset')

      this.$nextTick(() => { // allow userland to reset values before
        this.resetValidation()
        if (this.autofocus === true && this.noResetFocus !== true) {
          this.focus()
        }
      })
    },

    focus () {
      addFocusFn(() => {
        if (!this.$el) { return }

        const target = this.$el.querySelector('[autofocus], [data-autofocus]') ||
          Array.prototype.find.call(this.$el.querySelectorAll('[tabindex]'), el => el.tabIndex > -1)

        target !== null && target !== void 0 && target.focus({ preventScroll: true })
      })
    },

    getValidationComponents () {
      return Array.prototype.map.call(
        this.$el.getElementsByClassName('q-validation-component'),
        field => field.__vue__
      ).filter(c => c !== void 0 && typeof c.validate === 'function')
    }
  },

  render (h) {
    return h('form', {
      staticClass: 'q-form',
      on: this.onEvents
    }, slot(this, 'default'))
  }
})
