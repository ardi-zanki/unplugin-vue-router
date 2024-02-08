/**
 * @vitest-environment happy-dom
 */
import { App, Ref, defineComponent, shallowRef } from 'vue'
import { defineColadaLoader } from './defineColadaLoader'
import {
  describe,
  it,
  expect,
  vi,
  afterEach,
  beforeEach,
  beforeAll,
  afterAll,
} from 'vitest'
import {
  DataLoaderPlugin,
  DataLoaderPluginOptions,
  NavigationResult,
} from './navigation-guard'
import { testDefineLoader } from '../../tests/data-loaders'
import { setCurrentContext } from './utils'
import { UseDataLoader } from './createDataLoader'
import { getRouter } from 'vue-router-mock'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import RouterViewMock from '../../tests/data-loaders/RouterViewMock.vue'
import { setActivePinia, createPinia, Pinia } from 'pinia'
import { QueryPlugin } from '@pinia/colada'

describe(
  'defineColadaLoader',
  () => {
    enableAutoUnmount(afterEach)

    // we use fake timers to ensure debugging tests do not rely on timers
    const now = new Date(2000, 0, 1).getTime() // 1 Jan 2000 in local time as number of milliseconds
    beforeAll(() => {
      vi.useFakeTimers()
      vi.setSystemTime(now)
    })

    afterAll(() => {
      vi.useRealTimers()
    })

    testDefineLoader(
      ({ fn, key, ...options }) =>
        defineColadaLoader({ ...options, query: fn, key: () => [key ?? 'id'] }),
      {
        beforeEach() {
          const pinia = createPinia()
          // invalidate current context
          setCurrentContext(undefined)
          setActivePinia(pinia)
          return { pinia }
        },
        plugins: ({ pinia }) => [pinia, QueryPlugin],
      }
    )

    function singleLoaderOneRoute<Loader extends UseDataLoader>(
      useData: Loader,
      pluginOptions?: Omit<DataLoaderPluginOptions, 'router'>
    ) {
      let useDataResult: ReturnType<Loader>
      const component = defineComponent({
        setup() {
          // @ts-expect-error: wat?
          useDataResult = useData()

          const { data, error, isLoading } = useDataResult
          return { data, error, isLoading }
        },
        template: `\
<div>
  <p id="route">{{ $route.path }}</p>
  <p id="data">{{ data }}</p>
  <p id="error">{{ error }}</p>
  <p id="isLoading">{{ isLoading }}</p>
</div>`,
      })
      const router = getRouter()
      router.addRoute({
        name: '_test',
        path: '/fetch',
        meta: {
          loaders: [useData],
        },
        component,
      })

      const wrapper = mount(RouterViewMock, {
        global: {
          plugins: [
            [DataLoaderPlugin, { router, ...pluginOptions }],
            createPinia(),
            QueryPlugin,
          ],
        },
      })

      const app: App = wrapper.vm.$.appContext.app

      return {
        wrapper,
        router,
        useData: () => {
          if (useDataResult) {
            return useDataResult
          }
          // forced to ensure similar running context to within a component
          // this is for tests that call useData() before the navigation is finished
          setCurrentContext(undefined)
          return app.runWithContext(() => useData()) as ReturnType<Loader>
        },
        app,
      }
    }
  },
  // fail faster on unresolved promises
  { timeout: 100 }
)
