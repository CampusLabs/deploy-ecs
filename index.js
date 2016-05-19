const {ECS} = require('aws-sdk');

const ecs = new ECS();

const getTaskDefinition = ({cluster, service}) =>
  ecs.describeServices({cluster, services: [service]}).promise()
    .then(({services: {0: {taskDefinition}}}) =>
      ecs.describeTaskDefinition({taskDefinition}).promise()
    )
    .then(({taskDefinition}) => taskDefinition);

const updateContainerDefinition = ({containerDefinition, images}) => {
  const {image: existingImage} = containerDefinition;
  const [existingRepo] = existingImage.split(':');
  return images.reduce((containerDefinition, image) =>
    image.split(':')[0] === existingRepo && image !== existingImage ?
    Object.assign({}, containerDefinition, {image}) :
    containerDefinition
  , containerDefinition);
};

const updateContainerDefinitions = ({containerDefinitions, images}) => {
  for (let i = 0, l = containerDefinitions.length; i < l; ++i) {
    const containerDefinition = containerDefinitions[i];
    const newContainerDefinition =
      updateContainerDefinition({containerDefinition, images});
    if (newContainerDefinition === containerDefinition) continue;

    containerDefinitions = containerDefinitions.slice();
    containerDefinitions[i] = containerDefinition;
  }
  return containerDefinitions;
};

const updateTaskDefinition = ({taskDefinition, images}) => {
  const {containerDefinitions, family, volumes} = taskDefinition;
  const newTaskDefinition = {
    family,
    volumes,
    containerDefinitions:
      updateContainerDefinitions({containerDefinitions, images})
  };

  return (
    newTaskDefinition.containerDefinitions === containerDefinitions ?
    Promise.resolve({taskDefinition}) :
    ecs.registerTaskDefinition(newTaskDefinition).promise()
  ).then(({taskDefinition: {taskDefinitionArn: tdarn}}) => tdarn);
};

const updateService = ({cluster, service, taskDefinition}) =>
  ecs.updateService({cluster, service, taskDefinition}).promise();

const waitForStable = ({cluster, service}) =>
  ecs.waitFor('servicesStable', {cluster, services: [service]}).promise();

module.exports = ({cluster, service, images}) =>
  getTaskDefinition({cluster, service})
    .then(taskDefinition => updateTaskDefinition({taskDefinition, images}))
    .then(tdarn => updateService({cluster, service, taskDefinition: tdarn}))
    .then(() => waitForStable({cluster, service}));
