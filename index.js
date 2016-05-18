const {ECS} = require('aws-sdk');

const ecs = new ECS();

const getTaskDefinition = ({cluster, service: services}) =>
  ecs.describeServices({cluster, services}).promise()
    .then(({services: {0: {taskDefinition}}}) =>
      ecs.describeTaskDefinition({taskDefinition}).promise()
    )
    .then(({taskDefinition}) => taskDefinition);

const updateTaskDefinition = ({taskDefinition, images}) =>
  ecs.registerTaskDefinition({
    ...taskDefinition,
    containerDefinitions: taskDefinition.containerDefinitions.map(container =>
      updateContainer({container, images})
    )
  });

const updateContainer = ({container, images}) => {
  const [containerImageRepo] = container.image.split(':');
  return images.reduce((container, image) => {
    const [imageRepo] = image.split(':');
    if (imageRepo === containerImageRepo) container.image = image;
    return container;
  }, {...container});
};

const updateService = ({cluster, service, taskDefinition}) =>
  ecs.updateService({
    cluster,
    service,
    taskDefinition: taskDefinition.taskDefinitionArn
  }).promise();

module.exports = ({cluster, service, images}) =>
  getTaskDefinition({cluster, service})
    .then(taskDefinition => updateTaskDefinition({taskDefinition, images}))
    .then(taskDefinition => updateService({cluster, service, taskDefinition}));
