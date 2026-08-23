import { Reply } from '@neuralfog/hydris/http';
import { Route } from '@neuralfog/hydris/routing';
import { IndexController } from '../Http/Controllers/IndexController';
import { TestController } from '../Http/Controllers/TestController';

Route.get('/', [IndexController, 'index']);
Route.get('/nav-redirect', () => Reply.redirect('/nav-about-app'));
Route.getAll('/', TestController);
