import { Route } from '@neuralfog/hydris/routing';
import { IndexController } from '../Http/Controllers/IndexController';
import { TestController } from '../Http/Controllers/TestController';

Route.get('/', [IndexController, 'index']);
Route.getAll('/', TestController);
