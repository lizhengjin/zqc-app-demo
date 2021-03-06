/**
 * 在球场
 * zaiqiuchang.com
 */

import ImageResizer from 'react-native-image-resizer';

import logger from '../logger';
import {navToBootstrap, navToTab} from '../navigation';
import * as utils from '../utils';
import * as apis from '../apis';
import * as actions from './';

export const RESET_ACCOUNT = 'reset_account';
export const SET_ACCOUNT = 'set_account';
export const SET_CITY = 'set_city';
export const SET_SPORT = 'set_sport';

export function resetAccount() {
  return {
    type: RESET_ACCOUNT,
  };
}

export function setCity(city) {
  return {
    type: SET_CITY,
    city,
  };
}

export function setSport(sport) {
  return {
    type: SET_SPORT,
    sport,
  };
}

export function registerMobileSubmit(screenId, navigator) {
  return (dispatch, getState) => {
    let {input} = getState();
    dispatch(actions.validateInput(screenId, input[screenId], () => {
      let {mobile, password} = input[screenId];
      let cbOk = () => navigator.push({screen: 'zqc.RegisterVerify', title: '验证', passProps: {mobile, password}});
      dispatch(actions.sendVerifyCode({by: "mobile", mobile, cbOk}));
    }));
  };
}

export function registerVerifySubmit(screenId, navigator) {
  return (dispatch, getState) => {
    let {input} = getState();
    dispatch(actions.validateInput(screenId, input[screenId], () => {
      let {mobile, password, code} = input[screenId];
      apis.register({mobile, password, code})
        .then(response => {
          dispatch(login({mobile, password}, navigator));
        })
        .catch(error => {
          if (error instanceof apis.ResultError) {
            if (error.code == apis.ERROR_CODE_DUPLICATED) {
              dispatch(actions.errorFlash("手机号已注册过。"));
              return;
            } else if (error.code == apis.ERROR_CODE_INVALID_VERIFY_CODE) {
              dispatch(actions.errorFlash("验证码错误。"));
              return;
            }
          }
          dispatch(actions.handleApiError(error));
        });
    }));
  };
}

export function registerProfileSubmit(screenId, navigator) {
  return (dispatch, getState) => {
    let {object, account} = getState();
    let user = object.users[account.userId];
    if (user.nickname && user.avatarType && user.gender) {
      navToTab();
    } else {
      dispatch(actions.errorFlash("请填写完基本资料。"));
    }
  };
}

export function loginSubmit(screenId, navigator) {
  return (dispatch, getState) => {
    let {input} = getState();
    dispatch(actions.validateInput(screenId, input[screenId], () => {
      let {account, password} = input[screenId];
      let username, mobile, email;
      if (account.match(/^\d+$/) !== null) {
        mobile = account;
      } else if (account.match(/^.+@.+$/) !== null) {
        email = account;
      } else {
        username = account;
      }
      dispatch(login({username, mobile, email, password}, navigator));
    }));
  }
}

function login({username, mobile, email, password}, navigator) {
  return dispatch => {
    apis.login({username, mobile, email, password})
      .then(response => {
        let {data: {user}} = response;
        let cbOk = user => {
          if (user.nickname && user.avatarType && user.gender) {
            navToTab();
          } else {
            navigator.push({screen: 'zqc.RegisterProfile', title: '完善资料'});
          }
        };
        dispatch(setAccount({user, cbOk}));
      })
      .catch(error => {
        if (error instanceof apis.ResultError) {
          if (error.code == apis.ERROR_CODE_NOT_FOUND
            || error.code == apis.ERROR_CODE_WRONG_PASSWORD) {
            dispatch(actions.errorFlash("帐号或密码错误"));
            return;
          }
        }
        dispatch(actions.handleApiError(error));
      });
  };
}

export function setAccount({user, cbOk, cbFail}) {
  return (dispatch, getState) => {
    let {object} = getState();
    actions.cacheUsers(object, [user])
      .then(action => {
        dispatch(action);
        dispatch({type: SET_ACCOUNT, userId: user.id});
        if (cbOk) {
          cbOk(user);
        }
      })
      .catch(error => {
        dispatch(actions.handleApiError(error));
        if (cbFail) {
          cbFail(error);
        }
      });
  };
}

export function logoutRequest() {
  return (dispatch, getState) => {
    apis.logout()
      .then(response => navToBootstrap({passProps: {isReset: true}}))
      .catch(error => dispatch(actions.handleApiError(error)));
  };
}

export function editProfileNicknameSubmit(screenId, navigator) {
  return (dispatch, getState) => {
    let {input} = getState();
    dispatch(actions.validateInput(screenId, input[screenId], () => {
      apis.editAccount(input[screenId])
        .then(response => {
          let {data: {user}} = response;
          dispatch(setAccount({user, cbOk: () => navigator.pop()}));
        })
        .catch(error => dispatch(actions.handleApiError(error)));
    }));
  }
}

export function editProfileAvatarSubmit(screenId, navigator) {
  return (dispatch, getState) => {
    let {input} = getState();
    dispatch(actions.validateInput(screenId, input[screenId], () => {
      let {avatarType, avatarName, avatarUri} = input[screenId];
      let cbOk = response => {
        let {data: {user}} = response;
        dispatch(setAccount({user, cbOk: () => navigator.pop()}));
      };
      if (avatarType == 'builtin') {
        apis.editAccount({avatarType, avatarName})
          .then(cbOk)
          .catch(error => dispatch(actions.handleApiError(error)));
      } else if (avatarType == 'custom') {
        if (utils.isUrl(avatarUri)) {
          navigator.pop();
          return;
        }

        ImageResizer.createResizedImage(avatarUri, 1080, 810, 'JPEG', 90)
          .then(resizedImageUri => apis.uploadFile(resizedImageUri, 'image/jpeg'))
          .then(response => {
            let {data: {file}} = response;
            return apis.editAccount({avatarType, avatarId: file.id});
          })
          .then(cbOk)
          .catch(error => dispatch(actions.handleApiError(error)));
      }
    }));
  };
}

export function editProfileGenderSubmit(gender) {
  return (dispatch, getState) => {
    apis.editAccount({gender})
      .then(response => {
        let {data: {user}} = response;
        dispatch(setAccount({user}));
      })
      .catch(error => dispatch(actions.handleApiError(error)));
  };
}

export function updateAccountLocation() {
  return (dispatch, getState) => {
    let {network, location, object, account} = getState();
    let user = object.users[account.userId];
    if (!network.isConnected || !location.position || !user) {
      return;
    }

    apis.editAccount({location: location.position.coords}, true)
      .then(response => {
        let {data: {user}} = response;
        dispatch(setAccount({user}));
      })
      .catch(error => dispatch(actions.handleApiError(error)));
  };
}
