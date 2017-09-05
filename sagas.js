import { takeEvery, put, all, call, takeLatest } from 'redux-saga/effects';
import { delay } from 'redux-saga';

const myDelay = ms => new Promise(resolve => setTimeout(resolve, ms))

export function* helloSaga() {
    console.log('hello sagas');
}

// function* watchAndLog(getState) {
//     yield* takeEvery('*', function* logger(action) {
//         console.log('action', action);
//         console.log('state after', getState());
//     })
// }

function* watchAndLog(getState) {
    while (true) {
        const action = yield take('*');
        console.log('action', action);
        console.log('state after', getState());
    }
}

// 动作 Handler (类比于 Event hanlder)
export function* incrementAsyncWorker() {
    console.log('55')

    yield call(delay, 1000); // 调用外部的api
    yield put({ type: 'INCREMENT' })// 产生另一个action
}

// 监听'INCREMENT_ASYNC' 动作 (类比于 监听 Event)
export function* watchIncrementAsyncWorker() {
    console.log('qq')
    yield takeLatest('INCREMENT_ASYNC', incrementAsyncWorker);

    // 注意 试用 yield* 将不能正常运行
    // yield* takeEvery('INCREMENT_ASYNC', incrementAsyncWorker);
}

export default function* rootSagas() {
    yield all([
        helloSaga(),
        watchIncrementAsyncWorker()
    ])
}