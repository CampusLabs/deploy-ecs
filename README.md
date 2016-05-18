# deploy-ecs

Deploy images to ECS.

```js
import deployEcs from 'deploy-ecs';

deployEcs({
  cluster: 'my-cluster',
  service: 'my-service',
  images: ['nginx:123', 'myapp:456']
}).then(...).catch(...);
```
