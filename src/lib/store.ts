/* tslint:disable:no-expression-statement readonly-array no-shadowed-variable */
import { History } from 'history'
import LocationState = History.LocationState
import memoizeOne from 'memoize-one'

import { stringify } from 'query-string'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { create, StoreApi, UseStore } from 'zustand'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import {
  converter,
  historyManagement,
  immerWithPatches,
  StoreState
} from './middleware'
import { Serializer } from './serializers'
import {
  applyFlatConfigToState,
  createQueryObject,
  flattenConfig
} from './utils'

export const DEFAULT_NAMESPACE = 'default'

export const StoreContext = createContext<
  [UseStore<StoreState<any>>, StoreApi<StoreState<any>>] | null
>(null)

export interface Parameter {
  readonly name: string
  readonly serializer: Serializer
}

export interface MappedParameter extends Parameter {
  readonly path: readonly string[]
}

export interface Config {
  readonly [propName: string]: Config | (() => Parameter)
}

export interface MappedConfig {
  readonly [queryParameter: string]: MappedParameter
}

export const geschichte = (historyInstance: History<LocationState>) => {
  return create(
    immerWithPatches(
      historyManagement(historyInstance)(converter(historyInstance))
    )
  )
}

export const factoryParameters = <T = object>(
  config: Config,
  // tslint:disable-next-line:no-object-literal-type-assertion
  defaultInitialValues: T = {} as T,
  ns: string = DEFAULT_NAMESPACE
) => {
  const flatConfig = flattenConfig(config)
  const memoizedApplyFlatConfigToState = memoizeOne(
    applyFlatConfigToState,
    ([, nextInitialQueries, nextNs], [, previousInitialQueries, previousNs]) =>
      nextNs === previousNs && nextInitialQueries === previousInitialQueries
  )
  const useQuery = () => {
    const [useStore, api] = useContext(StoreContext) as [
      UseStore<StoreState<T>>,
      StoreApi<StoreState<T>>
    ]

    const {
      register,
      pushState,
      replaceState,
      resetPush,
      resetReplace,
      initialQueries
    } = useStore(
      ({
        register,
        pushState,
        replaceState,
        resetPush,
        resetReplace,
        initialQueries
      }) => ({
        initialQueries,
        pushState,
        register,
        replaceState,
        resetPush,
        resetReplace
      }),
      shallow
    )

    const initialRegisterState = useMemo(() => {
      const namespaceData = api.getState().namespaces[ns] || {}
      const { values, query, initialValues } = namespaceData
      if (values) {
        return {
          initialValues,
          query,
          values
        }
      }
      // thisValues will be mutated by applyFlatConfigToState, that's why we init it with a copy of
      // the initial state.
      const thisValues = { ...defaultInitialValues }
      const thisQuery = memoizedApplyFlatConfigToState(
        flatConfig,
        initialQueries,
        ns,
        thisValues,
        defaultInitialValues
      )
      return {
        initialValues: defaultInitialValues,
        query: thisQuery,
        values: thisValues
      }
    }, [api])

    const [currentState, setCurrentState] = useState({
      initialValues: defaultInitialValues,
      values: initialRegisterState.values
    })

    useEffect(() => {
      const unregister = register(
        config,
        flatConfig,
        ns,
        defaultInitialValues,
        initialRegisterState.query,
        initialRegisterState.values
      )

      const unsubscribe = api.subscribe<{
        readonly values: T
        readonly initialValues: T
      }>(
        state => {
          if (state) {
            setCurrentState(state)
          }
        },
        state => ({
          initialValues: state.namespaces[ns].initialValues,
          values: state.namespaces[ns].values
        }),
        shallow
      )

      return () => {
        unsubscribe()
        unregister()
      }
    }, [])

    const values = currentState.values
    const initialValues = currentState.initialValues

    return useMemo(
      () => ({
        createQueryString: (customValues?: object) =>
          stringify(
            createQueryObject(
              flatConfig,
              ns,
              customValues || values,
              initialValues
            )
          ),
        initialValues,
        pushState: (state: (state: T) => void) => pushState(ns, state),
        replaceState: (state: (state: T) => void) => replaceState(ns, state),
        resetPush: () => resetPush(ns),
        resetReplace: () => resetReplace(ns),
        values
      }),
      [values, initialValues, pushState, replaceState, resetPush, resetReplace]
    )
  }

  const createQueryString = (values: T) =>
    stringify(
      createQueryObject<T>(flatConfig, ns, values, defaultInitialValues)
    )

  return { useQuery, createQueryString }
}
