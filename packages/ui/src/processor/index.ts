import Factory from '@asra/factory'

Factory.sceneTreeMap.observe((event) => {
  event.delta.forEach((delta) => {
    // TODO: update changes to signals
  })
})
