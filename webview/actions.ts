import { ActionKeys, getActionKeys } from './action-types'

type actionItemCase = {
  aos: string
  ios: string
}

type actionsType = {
  basic: Record<string, actionItemCase>
  params: Record<string, (text: string, text2?: string) => actionItemCase>
}

type getActionsType = Record<string, actionItemCase>

export const actions: actionsType = {
  basic: {
    Home: { aos: 'navHome', ios: 'navHome' },
    Login: { aos: 'navLogin', ios: 'LoginVC' },
    Search: { aos: 'matching', ios: 'findphoca' },
    Consign: { aos: 'navConsignRec', ios: 'ConsignmentSellApplicationSelectMethodVC' },
    ConsignDiscard: { aos: 'navConsignRecDiscard', ios: 'ConsignmentSellApplicationSelectDiscard' },
    ConsignGuide: { aos: 'navGuideSell', ios: 'GuideSellVC' },
    ConsignHistory: { aos: 'navConsignHistory', ios: 'CSApplicationHistoryList' },
    PhoneVerify: { aos: 'navPhoneVerify', ios: 'PhoneVerifyVC' },
    QuickPurchase: { aos: 'navQuick', ios: 'QuickPurchaseVC' },
    CollectBook: { aos: 'navCollectBook', ios: 'CollectBookVC' },
    Wishlist: { aos: 'navWish', ios: 'WishedPhotoCardVC' },
    GuideBuy: { aos: 'navGuideBuy', ios: 'GuideBuyVC' },
    Mypage: { aos: 'navMypage', ios: 'MyPageVC' },
    Favorite: { aos: 'navFavorite', ios: 'SettingBiasGroupVC' },
    FAQ: { aos: 'navFAQ', ios: 'FAQVC' },
    Pass: { aos: 'navPassVerification', ios: 'PhoneVerifyVC' },
    BuzzBoosterDefault: { aos: 'navBuzzBoosterEventPage', ios: 'buzzBoosterEventPage' },
    notificationSetting: { aos: 'navNotificationSetting', ios: 'notificationSetting' },
    deviceNotificationSetting: {
      aos: 'deviceNotificationSetting',
      ios: 'deviceNotificationSetting',
    },
    KakaoPlus: { aos: 'goKakaoPlus', ios: 'MoveToKakaoTalkPlus' },
  },
  params: {
    ShareLink: (url) => ({ aos: `invitationCode/${url}`, ios: `ShareLink/${url}` }),
    PhotoCardDetail: (id) => ({ aos: `navPhocaDetail/${id}`, ios: `PhotoCardDetailVC/${id}` }),
    QuickPurchaseFilter: (groupId, memberId) => ({
      aos: `navQuickFilter/${groupId}${memberId ? `/${memberId}` : ''}`,
      ios: `navQuickFilter/${groupId}${memberId ? `/${memberId}` : ''}`,
    }),
    PhotoCardFilter: (groupId, memberId) => ({
      aos: `navSearchFilter/${groupId}${memberId ? `/${memberId}` : ''}`,
      ios: `navSearchFilter/${groupId}${memberId ? `/${memberId}` : ''}`,
    }),
    Twitter: (text) => ({ aos: `shareTwitter/${text}`, ios: `ShareTwitter/${text}` }),
    Kakao: (text) => ({ aos: `shareKakao/${text}`, ios: `ShareKakao/${text}` }),
    LookUp: (id) => ({ aos: `navPhocaDetail/${id}`, ios: `PhotoCardDetailVC/${id}` }),
    BuzzBooster: (id) => ({
      aos: `navBuzzBoosterEventPage/${id}`,
      ios: `buzzBoosterEventPage/${id}`,
    }),
    Amplitude: (value) => ({ aos: `amplitude/${value}`, ios: `amplitude/${value}` }),
    Notifly: (value) => ({ aos: `notifly/${value}`, ios: `notifly/${value}` }),
    saveImage: (text) => ({ aos: `saveImage/${text}`, ios: `saveImage/${text}` }),
  },
}

export const getActions: getActionsType = {
  DeviceNotification: { aos: 'deviceNoti', ios: 'notificationAuth' },
}

export const WebviewAction = (
  action: ActionKeys,
  isAOS: boolean,
  text?: string,
  text2?: string
) => {
  const keyword = text ? actions.params[action](text, text2) : actions.basic[action]
  if (!keyword) {
    console.error(`[WebviewAction] No implementation for action: ${action}`)
    return
  }
  try {
    if (isAOS) window.phoca?.getData(keyword.aos)
    else window.webkit?.messageHandlers?.scriptHandler?.postMessage(keyword.ios)
  } catch (e) {
    console.error(e)
  }
}

export const getWebviewAction = async (action: getActionKeys, isAOS: boolean) => {
  const keyword = getActions[action]
  try {
    if (isAOS) return window.phoca?.returnData(keyword.aos)
    else {
      const data = await window.webkit?.messageHandlers?.actionHandler?.postMessage(keyword.ios)
      return data
    }
  } catch {
    return null
  }
}
