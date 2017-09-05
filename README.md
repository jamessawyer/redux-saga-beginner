从 Saga 内触发异步操作（Side Effect）总是由 yield 一些声明式的 Effect 来完成的，一个 Saga 所做的实际上是组合那些所有的 Effect，共同实现所需的控制流。 

1. redux-thunk 是在 action 被创建的时候调用，而 Sagas 只会在应用启动时调用（但初始启动的 Sagas 可能会动态调用其他 Sagas）
2. Sagas 可以杯看作是后台运行的进程
3. **Sagas 监听发起的action, 然后决定基于这个action来做什么： 是发起一个异步调用(ajax请求)，还是发起其它action到store, 甚至可以调用其它的 Sagas**
4. 在 **`redux-saga`** 的世界里，所有的任务都是通过 **`yield Effects`** （Effects可以看成是redux-saga的任务单元）
5. **`Effects`** 都是简单的javascript对象，包含了要被Saga middleware执行的信息
6. **`redux-saga`** 为各项任务提供了各种Effect创建器，比如调用一个异步函数(**`call`**), 发起一个action到store, 启动一个后台任务(**`fork`**), 或者等待一个满足某条件的未来的action(**`take | takeEvery | takeLatest`**)
7. **`redux-saga`** 启动的任务可以在任何时候通过手动取消，也可以把任务和其他的Effects放到 **`race`** 方法里自动取消

## Effects 的含义
**`redux-saga`** 中，Sagas使用Generator函数实现，为了表达Saga逻辑，我们从Generator中 **`yield`** js 对象，产生的对象在**`redux-saga`**中称之为 **`Effects`**.

可以将 **`Effects`** 看作指导中间件实施某种操作的说明书, 比如告诉中间件调用某些异步函数，给store 发送某个动作。

Sagas能够产生多种形式的Effects,最简单的方式就是yield一个 **`Promise`**

## Effects 创建器

> 1.**takeEvery**

允许并发，即同时处理多个相同的action。在每个 `USER_FETCH_REQUESTED` action 被发起时调用 fetchUser,

行为类似于 **`redux-thunk`**

> 2.**takeLatest**

不允许并发，不允许并发，发起一个 `USER_FETCH_REQUESTED` action 时，如果在这之前已经有一个`USER_FETCH_REQUESTED` action 在处理中，那么处理中的 action 会被取消，只会执行当前的

> 3.**take**

**`take`** 创建另一个命令对象，告诉中间件等待一个特定的action,它将暂停Generator直到一个匹配的action被发起,它将主动拉取 action。

```
function* watchAndLog(getState) {
    while (true) {
        const action = yield take('*'); // 主动获取action 这给了我们更灵活的操作
        console.log('action', action);
        console.log('state after', getState());
    }
}
```

另一种方式实现上面的功能是使用 **`takeEvery`**, 但是这个需要我们传入action,并没有上面的控制方式好

```
function* watchAndLog(getState) {
    yield* takeEvery('*', function* logger(action) {
        console.log('action', action);
        console.log('state after', getState());
    })
}
```

等待某个动作,主动获取action

```
# 登录和退出逻辑可以写在一起
function* loginFlow() {
  while(true) {
    yield take('LOGIN')
    // ... perform the login logic
    yield take('LOGOUT')
    // ... perform the logout logic
  }
}
```

> 4.**call apply cps**


**`call`**讲异步调用变为声明式的，call创建一条描述结果的信息。这对于测试十分的友好，不必去模拟数据。

```
// 2种形式
call(fn, ...args)
call([context, fn], ...args) // 传递一个 this 上下文
```

另外 **`call`** 是一个阻塞式的Effect,即 Generator 在调用结束之前不能执行或处理任何其他事情.

**`cps`** 和上面的 **`call`**调用一样,这是一种延续传递风格（Continuation Passing Style））

```
// 2种形式
cps(fn, ...args)
cps([context, fn], ...args) // 传递一个 this 上下文
```

**`apply`** 这个和js里面的 **`call`** 和 **`apply`** 关系一样
```
apply(context, fn, args)
```

> 5.**put**

这个函数用于创建 dispatch Effect.这个用来创建一个对象，用来指示中间件我们需要发起某个action, 然后让中间件去执行真实的dispatch

```
import { put, call } from 'redux-saga/effects'

function* fetchProducts() {
    const products = yield call(Api.fetch, './products');
    // 创建并 yield 一个 dispatch Effect
    yield put({ type: 'PRODUCTS_RECEIVED', products })
}
```
这样写比直接dispatch更加的声明式，易于测试

```
// 不好 不便于测试
function* fetchProducts(dispatch)
  const products = yield call(Api.fetch, '/products')
  dispatch({ type: 'PRODUCTS_RECEIVED', products })
}
```

测试
```
import { call, put } from 'redux-saga/effects'
import Api from '...'

const iterator = fetchProducts()

// 期望一个 call 指令
assert.deepEqual(
  iterator.next().value,
  call(Api.fetch, '/products'),
  "fetchProducts should yield an Effect call(Api.fetch, './products')"
)

// 创建一个假的响应对象
const products = {}

// 期望一个 dispatch 指令
assert.deepEqual(
  iterator.next(products).value, // 将假设的对象传递到Generator中
  put({ type: 'PRODUCTS_RECEIVED', products }),
  "fetchProducts should yield an Effect put({ type: 'PRODUCTS_RECEIVED', products })"
)
```

> **fork && cancel && cancelled**

和 **`call`** 为阻塞式Effect不同的是，**`fork`** 是一个非阻塞式的Effect,它不会阻止Generator继续发起另一个action,并且返回一个**`Task` 对象**。

考虑一个**Login** 和 **Logout** 流程：
  1. 用户正常登录
  2. 用户登录成功之后登出
  3. 用户登录失败
  4. 在用户登录登录完成之前，点击了登出，但是登录没有被取消，退出之后，返回登录成功的信息

使用**`call`**就会阻塞其它动作，比如上面的4

```
import { put, take, fork, cancel, call, cancelled } from 'redux-saga/effects'

function* authorize(user, password) {
    try {
        const token = yield put(Api.authorize, user, password);
        yield put({ type: 'LOGIN_SUCCESS', token})
        yield call(Api.storeToken, token); // 将返回的token存在本地
        return token;
    } catch(error) {
        yield put({ type: 'LOGIN_ERROR', error })
    } finally { // 任意完成之后或者取消之后的逻辑都可以放在finally块中
        if (yield cancelled()) {
            // 取消操作逻辑放在这里
        }
    }
}

function* loginFlow() {
    while (true) {
        // 等待 'LOGIN_REQUEST'动作
        // 如果是这个动作，中间件将dispatch这个动作，并且返回一些payload
        const {user, password} =yield take('LOGIN_REQUEST');

        // 使用 fork 非阻塞式的调用api, 不会阻塞下面的'LOGOUT', 'LOGIN_ERROR'动作
        const task = yield fork(authorize, user, password); // 返回一个task对象

        const action = yield take(['LOGOUT', 'LOGIN_ERROR']);
        if (action.type === 'LOGOUT') { // 如果是退出操作，则取消上面的task
            // cancel Effect 不会粗暴地结束我们的 authorize 任务，它会在里面抛出一个特殊的错误
            // 给 authorize 一个机会执行它自己的清理逻辑。
            // 而被取消的任务应该捕捉这个错误，假设它需要在结束之前做一些事情的话。
            yield cancel(task)
        }
        yield call(Api.clearItem('token')); // 清除 token
    }
} 
```

> **all**

这个Effect和**`Promise.all()`** 的作用是一样的，可以用于同时执行多个任务

```
import { call } from 'redux-saga/effects'

// 正确写法, effects 将会同步执行
const [users, repos] = yield all[
  call(fetch, '/users'),
  call(fetch, '/repos')
]
```
当然也可以使用 **`fork`** 来实现相同的操作


## 错误处理

一般可以使用 **`try...catch...`** 来捕获异常，在**`try...catch...`**中dispatch不同的action


```
import Api from './path/to/api'
import { call, put } from 'redux-saga/effects';

function* fetchProducts() {
    try {
        const products = yield call(Api.fetch, './product');
        yield put({ type: 'PRODUCTS_REQUEST_SUCCESS', products})
    } catch(error) {
        yield put({ type: 'PRODUCTS_REQUEST_ERROR', error})
    }
}
```

另一种方式是，我们还可以让 **API服务返回一个正常的含有错误标志的值。**比如可以捕获Promise的拒绝操作，讲它映射到一个错误字段对象

```
import Api from './path/to/api'
import { take, put } from 'redux-saga/effects'

// 返回一个正常的含有错误标志的值
function fetchProductsApi() {
  return Api.fetch('/products')
    .then(response => {response})
    .catch(error => {error})
}

function* fetchProducts() {
  const { response, error } = yield call(fetchProductsApi); 
  if(response)
    yield put({ type: 'PRODUCTS_RECEIVED', products: response })
  else
    yield put({ type: 'PRODUCTS_REQUEST_FAILED', error })
}
```

> **不能从forked tasks 中捕获错误**


因为 **`fork`** 是非阻塞的Effect,我们不能从其中捕获错误。

```
function* fetchAll() {
  const task1 = yield fork(fetchResource, 'users')
  const task2 = yield fork(fetchResource, 'comments')
  yield call(delay, 1000)
}
// 等同于
function* fetchAll() {
  yield all([
      call(fetchResource, 'users'),
      call(fetchResource, 'comments'),
      call(delay, 1000)
  ])
}

function* fetchResource(resource) {
  const {data} = yield call(api.fetch, resource)
  yield put(receiveData(data))
}

function* main() {
  // 这个main task能够捕获错误，是因为我们使用了call
  // 它是一个阻塞的 Effect  
  try {
    yield call(fetchAll)
  } catch (e) {
    // handle fetchAll errors
  }
}
```

## 取消

如果存在多个fork tasks,如果其中一个失败了，则其余的tasks将自动取消，如果某个task抛出错误，则主task也将抛出错误

```
// 假如task1失败了， 则task2 call将自动取消
// main task也将自动取消
// 如果task1抛出错误，则main task也将抛出自己的错误
function* fetchAll() {
  const task1 = yield fork(fetchResource, 'users')
  const task2 = yield fork(fetchResource, 'comments')
  yield call(delay, 1000)
}

function* fetchResource(resource) {
  const {data} = yield call(api.fetch, resource)
  yield put(receiveData(data))
}

function* main() {
  // 这个main task能够捕获错误，是因为我们使用了call
  // 它是一个阻塞的 Effect  
  try {
    yield call(fetchAll)
  } catch (e) {
    // handle fetchAll errors
  }
}
```

### 取消分离的forks 使用 spawn

**`spawn`** Effect 将建立一个分离的fork task，它将存在于自己的执行上下文。取消main task也不会影响 detached task.简单的讲就是，detached forks 的行为就像root Sagas一样直接使用 **`middleware.run`** 来启动

