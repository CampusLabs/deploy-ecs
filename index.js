const {ECS} = require('aws-sdk');

const ecs = new ECS();

const getTaskDefinition = ({cluster, service}) =>
  ecs.describeServices({cluster, services: [service]}).promise()
    .then(({services}) => {
      if (!services.length) {
        throw new Error(`Cannot find service ${service} in cluster ${cluster}`);
      }

      const {0: {taskDefinition}} = services;
      return ecs.describeTaskDefinition({taskDefinition}).promise();
    })
    .then(({taskDefinition}) => taskDefinition);

const updateContainerDefinition = ({containerDefinition, images}) => {
  const [existingRepo] = containerDefinition.image.split(':');
  for (let i = 0, l = images.length; i < l; ++i) {
    const image = images[i];
    const [repo] = image.split(':');
    if (repo === existingRepo) {
      return Object.assign({}, containerDefinition, {image});
    }
  }
  return containerDefinition;
};

const updateTaskDefinition = ({taskDefinition, images}) => {
  const {containerDefinitions, family, volumes} = taskDefinition;
  return ecs.registerTaskDefinition({
    family,
    volumes,
    containerDefinitions: containerDefinitions.map(containerDefinition =>
      updateContainerDefinition({containerDefinition, images})
    )
  }).promise().then(({taskDefinition}) => taskDefinition);
};

const updateService = ({cluster, service, taskDefinition}) =>
  ecs.updateService({
    cluster,
    service,
    taskDefinition: taskDefinition.taskDefinitionArn
  }).promise();

const waitForStable = ({cluster, service}) =>
  ecs.waitFor('servicesStable', {cluster, services: [service]}).promise();

const wrapError = obj =>
  er => { throw Object.assign(new Error(er.message), er, obj); };

module.exports = ({cluster, service, images}) =>
  getTaskDefinition({cluster, service})
    .then(prevTaskDefinition =>
      updateTaskDefinition({taskDefinition: prevTaskDefinition, images})
        .then(nextTaskDefinition =>
          updateService({
            cluster,
            service,
            taskDefinition: nextTaskDefinition
          }).then(() => waitForStable({cluster, service}))
            .then(() => ({prevTaskDefinition, nextTaskDefinition}))
            .catch(wrapError({nextTaskDefinition}))
        ).catch(wrapError({prevTaskDefinition}))
  );
