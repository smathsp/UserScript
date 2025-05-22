// ==UserScript==
// @name         B站推流码获取工具
// @namespace    https://github.com/smathsp
// @version      1.5
// @description  获取第三方推流码
// @author       smathsp
// @license      GPL-3.0
// @match        *://*.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_notification
// @connect      api.live.bilibili.com
// @connect      passport.bilibili.com
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  // 存储键名常量
  const STORAGE_KEYS = {
    LAST_ROOM_ID: "bili_last_roomid",
    DARK_MODE: "bili_dark_mode",
    IS_LIVE_STARTED: "isLiveStarted",
    STREAM_INFO: "streamInfo",
    LAST_GROUP_ID: "bili_last_groupid",
    LAST_AREA_ID: "bili_last_areaid",
    AREA_LIST_TIME: "bili_area_list_time",
    AREA_LIST: "bili_area_list",
    USER_MID: "bili_user_mid",
    LAST_TITLE: "bili_last_title",
  };

  // API URL Constants
  const API_URL_AREA_LIST =
    "https://api.live.bilibili.com/room/v1/Area/getList?show_pinyin=1";
  const API_URL_START_LIVE =
    "https://api.live.bilibili.com/room/v1/Room/startLive";
  const API_URL_UPDATE_ROOM =
    "https://api.live.bilibili.com/room/v1/Room/update";
  const API_URL_STOP_LIVE =
    "https://api.live.bilibili.com/room/v1/Room/stopLive";

  // 示例：将 GM_xmlhttpRequest Promise 化
  function gmRequest(options) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        ...options,
        onload: resolve,
        onerror: reject, // GM_xmlhttpRequest 的 onerror 通常也传递 response 对象
        ontimeout: reject, // 同样
        onabort: reject, // 同样
      });
    });
  }

  // SVG 图标常量
  const SUN_SVG =
    '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="5" fill="#FFD600"/><g stroke="#FFD600" stroke-width="2"><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></g></svg>';
  const MOON_SVG =
    '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M21 12.79A9 9 0 0 1 12.21 3c-.55 0-.66.71-.19.93A7 7 0 1 0 20.07 12c.22.47-.38.74-.87.79z" fill="#888"/></svg>';
  const CLOSE_SVG =
    '<svg viewBox="0 0 1024 1024" width="16" height="16"><path d="M512 421.49 331.09 240.58c-24.74-24.74-64.54-24.71-89.28 0.03-24.74 24.74-24.72 64.54 0.03 89.28L422.75 510.8 241.84 691.71c-24.74 24.74-24.72 64.54 0.03 89.33 24.74 24.74 64.54 24.71 89.28-0.03L512 600.1l180.91 180.91c24.74 24.74 64.54 24.71 89.28-0.03 24.74-24.74 24.72-64.54-0.03-89.28L601.25 510.8 782.16 329.89c24.74-24.74 24.72-64.54-0.03-89.33-24.74-24.74-64.54-24.71-89.28 0.03L512 421.49z" fill="#888888"></path></svg>';

  // 插入全局样式表，统一亮暗色模式
  function insertGlobalStyle() {
    if (document.getElementById("bili-stream-global-style")) return;
    const style = document.createElement("style");
    style.id = "bili-stream-global-style";
    style.innerHTML = `
        :root {
            --bili-bg: #fff;
            --bili-fg: #222;
            --bili-panel-shadow: 0 2px 10px rgba(0,0,0,0.1);
            --bili-border: #eee;
            --bili-input-bg: #fff;
            --bili-input-fg: #222;
            --bili-input-border: #ddd;
            --bili-tip-bg: #fef0f1;
            --bili-tip-fg: #d92b46;
            --bili-tip-border: #fb7299;
            --bili-btn-main: #fb7299;
            --bili-btn-main-hover: #fc8bab;
            --bili-btn-main-disabled: #bfbfbf;
            --bili-btn-stop: #ff4b4b;
            --bili-btn-stop-hover: #d9363e;
            --bili-btn-stop-disabled: #999;
            --bili-btn-text: #fff;
            --bili-title-color: #fb7299;
            --bili-label-color: #666;
            --bili-tip-yellow-bg: #fffbe6;
            --bili-tip-yellow-border: #faad14;
            --bili-tip-yellow-fg: #faad14;
            --bili-tip-green-bg: #e6ffed;
            --bili-tip-green-border: #52c41a;
            --bili-tip-green-fg: #389e0d;
        }
        .bili-dark-mode {
            --bili-bg: #232324;
            --bili-fg: #eee;
            --bili-panel-shadow: 0 2px 10px rgba(0,0,0,0.6);
            --bili-border: #444;
            --bili-input-bg: #18181a;
            --bili-input-fg: #eee;
            --bili-input-border: #444;
            --bili-tip-bg: #2d2326;
            --bili-tip-fg: #ffb6c1;
            --bili-tip-border: #fb7299;
            --bili-btn-main: #fb7299;
            --bili-btn-main-hover: #fc8bab;
            --bili-btn-main-disabled: #bfbfbf;
            --bili-btn-stop: #ff4b4b;
            --bili-btn-stop-hover: #d9363e;
            --bili-btn-stop-disabled: #999;
            --bili-btn-text: #fff;
            --bili-title-color: #fb7299;
            --bili-label-color: #aaa;
            --bili-tip-yellow-bg: #3a2d1a;
            --bili-tip-yellow-border: #faad14;
            --bili-tip-yellow-fg: #ffd666;
            --bili-tip-green-bg: #1e2b22;
            --bili-tip-green-border: #52c41a;
            --bili-tip-green-fg: #b7eb8f;
        }
        #bili-stream-code-panel {
            background-color: var(--bili-bg) !important;
            color: var(--bili-fg) !important;
            box-shadow: var(--bili-panel-shadow) !important;
            border-radius: 8px;
            padding: 15px;
            font-family: "Microsoft YaHei", sans-serif;
        }
        #bili-result {
            background-color: var(--bili-bg) !important;
            color: var(--bili-fg) !important;
            border: 1px solid var(--bili-border) !important;
            border-radius: 4px;
            margin-top: 15px;
            padding: 10px;
        }
        .bili-input {
            background: var(--bili-input-bg) !important;
            color: var(--bili-input-fg) !important;
            border: 1px solid var(--bili-input-border) !important;
            border-radius: 4px;
            padding: 8px;
            font-size: 14px;
        }
        .bili-select {
            background: var(--bili-input-bg) !important;
            color: var(--bili-input-fg) !important;
            border: 1px solid var(--bili-input-border) !important;
            border-radius: 4px;
            padding: 8px;
            font-size: 14px;
        }
        #bili-room-id, #bili-title, #server-addr, #stream-code {
            background: var(--bili-input-bg) !important;
            color: var(--bili-input-fg) !important;
            border: 1px solid var(--bili-input-border) !important;
            border-radius: 4px;
            padding: 8px;
            font-size: 14px;
        }
        #bili-area-group, #bili-area {
            background: var(--bili-input-bg) !important;
            color: var(--bili-input-fg) !important;
            border: 1px solid var(--bili-input-border) !important;
            border-radius: 4px;
            padding: 8px;
            font-size: 14px;
        }
        .bili-important-tip {
            background-color: var(--bili-tip-bg) !important;
            color: var(--bili-tip-fg) !important;
            border-left: 4px solid var(--bili-tip-border) !important;
            border-radius: 4px;
            margin-top: 8px;
            padding: 8px;
        }
        .bili-tip-yellow {
            background: var(--bili-tip-yellow-bg);
            border-left: 4px solid var(--bili-tip-yellow-border);
            color: var(--bili-tip-yellow-fg);
            border-radius: 4px;
            margin-top: 8px;
            padding: 8px;
        }
        .bili-tip-green {
            background: var(--bili-tip-green-bg);
            border-left: 4px solid var(--bili-tip-green-border);
            color: var(--bili-tip-green-fg);
            border-radius: 4px;
            margin-top: 8px;
            padding: 8px;
        }
        .bili-btn-main {
            background: var(--bili-btn-main);
            color: var(--bili-btn-text);
            border: none;
            border-radius: 4px;
            padding: 10px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s, opacity 0.3s;
        }
        .bili-btn-main:hover:not(:disabled) {
            background: var(--bili-btn-main-hover);
        }
        .bili-btn-main:disabled {
            background: var(--bili-btn-main-disabled);
            opacity: 0.5;
            cursor: not-allowed;
        }
        .bili-btn-stop {
            background: var(--bili-btn-stop);
            color: var(--bili-btn-text);
            border: none;
            border-radius: 4px;
            padding: 10px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s, opacity 0.3s;
        }
        .bili-btn-stop:hover:not(:disabled) {
            background: var(--bili-btn-stop-hover);
        }
        .bili-btn-stop:disabled {
            background: var(--bili-btn-stop-disabled);
            opacity: 0.5;
            cursor: not-allowed;
        }
        .bili-title {
            color: var(--bili-title-color);
            font-size: 18px;
            margin: 0;
        }
        .bili-label {
            color: var(--bili-label-color);
            font-size: 14px;
        }
        .bili-copy-btn {
            margin-left: 5px;
            background: var(--bili-btn-main);
            color: var(--bili-btn-text);
            border: none;
            border-radius: 4px;
            padding: 8px;
            cursor: pointer;
            transition: background 0.3s;
        }
        .bili-copy-btn:disabled {
            background: var(--bili-btn-main-disabled);
            cursor: not-allowed;
        }
        .bili-copy-btn:hover:not(:disabled) {
            background: var(--bili-btn-main-hover);
        }
        .bili-message {
            color: var(--bili-fg);
            font-size: 15px;
            margin: 0;
        }
        .bili-message-error {
            color: red;
        }
        `;
    document.head.appendChild(style);
  }

  // 全局变量
  let roomId = null; // 当前房间ID
  let csrf = null; // CSRF令牌
  let startLiveButton = null; // “开始直播”按钮引用
  let stopLiveButton = null; // “结束直播”按钮引用
  let isLiveStarted = GM_getValue(STORAGE_KEYS.IS_LIVE_STARTED, false); // 直播状态
  let streamInfo = GM_getValue(STORAGE_KEYS.STREAM_INFO, null); // 推流信息缓存

  // 请求头
  const headers = {
    accept: "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://link.bilibili.com",
    referer: "https://link.bilibili.com/p/center/index",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  };

  // 开始直播数据模板
  const startData = {
    room_id: "",
    platform: "android_link",
    area_v2: "",
    backup_stream: "0",
    csrf_token: "",
    csrf: "",
  };

  // 停止直播数据模板
  const stopData = {
    room_id: "",
    platform: "android_link",
    csrf_token: "",
    csrf: "",
  };

  // 修改直播标题数据模板
  const titleData = {
    room_id: "",
    platform: "android_link",
    title: "",
    csrf_token: "",
    csrf: "",
  };

  // 初始化入口
  function init() {
    try {
      insertGlobalStyle(); // 插入全局样式
      removeExistingComponents(); // 清理旧组件
      createUI(); // 创建UI（只创建一次主面板）
      restoreLiveState(); // 恢复直播状态
      // setInterval(checkFloatButton, 5000); // 定期检查浮动按钮 - REMOVED
    } catch (error) {
      console.error("B站推流码获取工具初始化失败:", error);
    }
  }

  // 移除已存在的组件
  function removeExistingComponents() {
    const existingPanel = document.getElementById("bili-stream-code-panel");
    if (existingPanel) existingPanel.remove();
    const existingButton = document.getElementById("bili-stream-float-button");
    if (existingButton) existingButton.remove();
    // 清空按钮引用，防止旧引用干扰
    startLiveButton = null;
    stopLiveButton = null;
  }

  // 创建UI（只创建一次主面板）
  function createUI() {
    // 若主面板已存在则不再重复创建
    if (!document.getElementById("bili-stream-code-panel")) {
      const panel = createPanel();
      panel.style.display = "none";
    }
    // 浮动按钮可重复创建（防止丢失）
    createFloatButton();
    // 自动填充房间ID的逻辑已移至 createPanelForm
  }

  // 创建面板
  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "bili-stream-code-panel";
    panel.style.cssText = `
            position: fixed;
            top: 70px;
            right: 10px;
            width: 300px;
            z-index: 10000;
            display: none;
        `;
    // 头部区域
    const header = createPanelHeader();
    panel.appendChild(header);
    // 表单区域
    const form = createPanelForm();
    panel.appendChild(form);
    // 结果区域
    const resultArea = document.createElement("div");
    resultArea.id = "bili-result";
    resultArea.style.cssText = `
            margin-top: 15px;
            padding: 10px;
            border: 1px solid #eee;
            border-radius: 4px;
            background-color: #f9f9f9;
            display: none;
        `;
    panel.appendChild(resultArea);
    document.body.appendChild(panel);
    // 缓存常用元素引用
    return panel;
  }

  // 创建面板头部
  function createPanelHeader() {
    const header = document.createElement("div");
    header.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;";

    // 标题
    const title = document.createElement("h2");
    title.textContent = "B站推流码获取工具";
    title.className = "bili-title";

    // 亮暗模式切换按钮
    const modeBtn = document.createElement("button");
    modeBtn.id = "bili-mode-toggle";
    modeBtn.style.cssText =
      "width: 28px; height: 28px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: 8px;";
    // SVG 图标
    let isDarkMode = GM_getValue(STORAGE_KEYS.DARK_MODE, false);
    modeBtn.innerHTML = isDarkMode ? MOON_SVG : SUN_SVG;
    modeBtn.title = isDarkMode ? "切换为亮色模式" : "切换为暗色模式";
    modeBtn.onclick = function () {
      isDarkMode = !isDarkMode;
      GM_setValue(STORAGE_KEYS.DARK_MODE, isDarkMode);
      modeBtn.innerHTML = isDarkMode ? MOON_SVG : SUN_SVG;
      modeBtn.title = isDarkMode ? "切换为亮色模式" : "切换为暗色模式";
      applyColorMode(isDarkMode);
    };
    // 首次渲染时应用模式
    setTimeout(() => applyColorMode(isDarkMode), 0);

    // 关闭按钮
    const closeButton = document.createElement("button");
    closeButton.innerHTML = CLOSE_SVG;
    closeButton.style.cssText =
      "width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center;";
    closeButton.onclick = () => {
      document.getElementById("bili-stream-code-panel").style.display = "none";
    };

    // 头部右侧按钮组
    const rightBtns = document.createElement("div");
    rightBtns.style.cssText = "display: flex; align-items: center; gap: 4px;";
    rightBtns.appendChild(modeBtn);
    rightBtns.appendChild(closeButton);

    header.appendChild(title);
    header.appendChild(rightBtns);
    return header;
  }

  // 亮暗模式应用函数
  function applyColorMode(isDark) {
    // 只切换 class，不再手动设置 style
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("bili-dark-mode");
    } else {
      root.classList.remove("bili-dark-mode");
    }
  }

  // 创建面板表单
  function createPanelForm() {
    const form = document.createElement("div");
    form.style.cssText = "display: flex; flex-direction: column; gap: 10px;";

    // 房间ID输入
    form.appendChild(createRoomIdInput());

    // 分区选择
    const areaSelectionElement = createAreaSelection();
    form.appendChild(areaSelectionElement);

    if (areaSelectionElement.loadAndBindAreaListPromise) {
      areaSelectionElement.loadAndBindAreaListPromise
        .then(() => {
          autoFillRoomId();
        })
        .catch((error) => {
          console.error(
            "Error during area list loading, or in autoFillRoomId:",
            error
          );
          // Fallback if promise rejects
          setTimeout(autoFillRoomId, 300);
        });
    } else {
      // Fallback if the promise wasn't attached
      console.warn(
        "loadAndBindAreaListPromise not found, falling back for autoFillRoomId."
      );
      setTimeout(autoFillRoomId, 300);
    }

    // 标题输入
    form.appendChild(createTitleInput());

    // 按钮组
    form.appendChild(createButtonGroup());

    return form;
  }

  // 创建房间ID输入
  function createRoomIdInput() {
    const container = document.createElement("div");
    container.style.cssText =
      "display: flex; flex-direction: column; gap: 5px;";
    const label = document.createElement("label");
    label.textContent = "房间ID (Room ID):";
    label.className = "bili-label";

    const input = document.createElement("input");
    input.type = "text";
    input.id = "bili-room-id";
    input.placeholder = "请输入你的房间ID";
    input.className = "bili-input";
    // 新增：输入时保存
    input.addEventListener("blur", function () {
      GM_setValue(STORAGE_KEYS.LAST_ROOM_ID, input.value.trim());
    });

    container.appendChild(label);
    container.appendChild(input);

    return container;
  }

  // 创建分区选择
  function createAreaSelection() {
    const container = document.createElement("div");
    container.id = "bili-area-selection-container"; // 新增ID，方便获取
    container.style.cssText =
      "display: flex; flex-direction: column; gap: 5px;";
    const label = document.createElement("label");
    label.textContent = "直播分区:";
    label.className = "bili-label";

    // 加载指示器
    const loading = document.createElement("div");
    loading.id = "bili-area-loading";
    loading.textContent = "正在加载分区列表...";
    loading.style.cssText =
      "padding: 8px; color: #666; font-size: 14px; text-align: center; cursor: pointer;";

    // 分区组选择器
    const groupSelect = document.createElement("select");
    groupSelect.id = "bili-area-group";
    groupSelect.className = "bili-select";
    groupSelect.style.cssText = "margin-bottom: 8px; display: none;";

    // 子分区选择器
    const areaSelect = document.createElement("select");
    areaSelect.id = "bili-area";
    areaSelect.className = "bili-select";
    areaSelect.style.cssText = "display: none;";

    // 统一事件绑定
    groupSelect.addEventListener("change", function () {
      const areaList = getCachedAreaList() || [];
      const selectedIndex = this.options[this.selectedIndex].dataset.index;
      GM_setValue(STORAGE_KEYS.LAST_GROUP_ID, groupSelect.value);
      updateAreaSelectors(
        areaList,
        Number(selectedIndex),
        groupSelect,
        areaSelect
      );
    });
    areaSelect.addEventListener("change", function () {
      GM_setValue(STORAGE_KEYS.LAST_AREA_ID, areaSelect.value);
      GM_setValue(STORAGE_KEYS.LAST_GROUP_ID, groupSelect.value);
    });
    loading.onclick = function () {
      if (
        loading.style.color === "rgb(255, 75, 75)" ||
        loading.style.color === "#ff4b4b"
      ) {
        loadAndBindAreaList();
      }
    };

    container.appendChild(label);
    container.appendChild(loading);
    container.appendChild(groupSelect);
    container.appendChild(areaSelect);

    // 合并后的分区刷新函数
    function updateAreaSelectors(
      areaList,
      groupIdx = 0,
      groupSel = groupSelect,
      areaSel = areaSelect
    ) {
      groupSel.innerHTML = "";
      areaSel.innerHTML = "";
      areaList.forEach((group, idx) => {
        const option = document.createElement("option");
        option.value = group.id;
        option.textContent = group.name;
        option.dataset.index = idx;
        groupSel.appendChild(option);
      });
      // 恢复上次大类
      const lastGroupId = GM_getValue(STORAGE_KEYS.LAST_GROUP_ID);
      if (lastGroupId) {
        for (let i = 0; i < groupSel.options.length; i++) {
          if (groupSel.options[i].value == lastGroupId) {
            groupSel.selectedIndex = i;
            groupIdx = i;
            break;
          }
        }
      }
      if (areaList[groupIdx] && areaList[groupIdx].list) {
        areaList[groupIdx].list.forEach((area) => {
          const option = document.createElement("option");
          option.value = area.id;
          option.textContent = area.name;
          areaSel.appendChild(option);
        });
      }
      // 恢复上次分区id
      const lastAreaId = GM_getValue(STORAGE_KEYS.LAST_AREA_ID);
      if (lastAreaId && areaSel.options.length > 0) {
        for (let i = 0; i < areaSel.options.length; i++) {
          if (areaSel.options[i].value == lastAreaId) {
            areaSel.selectedIndex = i;
            break;
          }
        }
      }
      // 显示选择器
      loading.style.display = "none";
      groupSel.style.display = "block";
      areaSel.style.display = "block";
    }

    // 加载分区数据
    function loadAndBindAreaList() {
      return new Promise(async (resolve, reject) => {
        // Make the wrapping function async
        // 返回 Promise
        loading.style.display = "block";
        groupSelect.style.display = "none";
        areaSelect.style.display = "none";
        loading.textContent = "正在加载分区列表...";
        loading.style.color = "#666";
        const cachedList = getCachedAreaList();
        if (cachedList) {
          updateAreaSelectors(cachedList, 0, groupSelect, areaSelect);
          resolve(); // 解析 Promise
          return;
        }
        try {
          const response = await gmRequest({
            // Use await with gmRequest
            method: "GET",
            url: API_URL_AREA_LIST,
            headers: headers,
          });
          const result = JSON.parse(response.responseText);
          if (result.code === 0) {
            cacheAreaList(result.data);
            updateAreaSelectors(result.data, 0, groupSelect, areaSelect);
            resolve(); // 解析 Promise
          } else {
            console.error("Area list API error:", result);
            showAreaLoadError();
            reject(new Error("Failed to load area list")); // 拒绝 Promise
          }
        } catch (errorResponse) {
          // Catch errors from gmRequest
          console.error("Area list request error:", errorResponse);
          showAreaLoadError();
          reject(errorResponse); // 拒绝 Promise
        }
      });
    }

    // 将 Promise 附加到容器元素，以便在 createUI 中访问
    container.loadAndBindAreaListPromise = loadAndBindAreaList();
    return container;
  }

  // 创建标题输入
  function createTitleInput() {
    const container = document.createElement("div");
    container.style.cssText =
      "display: flex; flex-direction: column; gap: 5px;";

    const label = document.createElement("label");
    label.textContent = "直播标题:";
    label.className = "bili-label";

    const input = document.createElement("input");
    input.type = "text";
    input.id = "bili-title";
    input.placeholder = "请输入直播标题";
    input.className = "bili-input";
    // 新增：输入时保存
    input.addEventListener("blur", function () {
      GM_setValue(STORAGE_KEYS.LAST_TITLE, input.value.trim());
    });

    container.appendChild(label);
    container.appendChild(input);

    return container;
  }

  // 创建按钮组
  function createButtonGroup() {
    const container = document.createElement("div");
    container.style.cssText = "display: flex; gap: 10px; margin-top: 10px;";

    // 开始直播按钮
    startLiveButton = document.createElement("button");
    startLiveButton.textContent = "获取推流码并开始直播";
    startLiveButton.className = "bili-btn-main";
    startLiveButton.style.flex = "1";
    startLiveButton.onclick = startLive;

    // 结束直播按钮
    stopLiveButton = document.createElement("button");
    stopLiveButton.textContent = "结束直播";
    stopLiveButton.className = "bili-btn-stop";
    stopLiveButton.style.flex = "1";
    stopLiveButton.disabled = true;
    stopLiveButton.onclick = stopLive;

    container.appendChild(startLiveButton);
    container.appendChild(stopLiveButton);

    return container;
  }

  // 创建浮动按钮
  function createFloatButton() {
    const button = document.createElement("div");
    button.id = "bili-stream-float-button";
    button.innerHTML =
      '<svg viewBox="0 0 1024 1024" width="24" height="24"><path d="M718.3 183.7H305.7c-122 0-221 99-221 221v214.6c0 122 99 221 221 221h412.6c122 0 221-99 221-221V404.7c0-122-99-221-221-221z m159.1 435.6c0 87.6-71.5 159.1-159.1 159.1H305.7c-87.6 0-159.1-71.5-159.1-159.1V404.7c0-87.6 71.5-159.1 159.1-159.1h412.6c87.6 0 159.1 71.5 159.1 159.1v214.6z" fill="#FFFFFF"></path><path d="M415.5 532.2v-131c0-7.1 3.8-13.6 10-17.1 6.2-3.5 13.7-3.5 19.9 0l131 75.1c6.2 3.5 10 10.1 10 17.1 0 7.1-3.8 13.6-10 17.1l-131 65.5c-6.2 3.5-13.7 3.5-19.9 0-6.2-3.5-10-10.1-10-17.1v-9.6z" fill="#FFFFFF"></path></svg>';
    button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background-color: #fb7299;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            z-index: 10001;
            transition: transform 0.3s;
        `;
    button.onmouseover = function () {
      this.style.transform = "scale(1.1)";
    };
    button.onmouseout = function () {
      this.style.transform = "scale(1)";
    };
    button.onclick = togglePanel;

    document.body.appendChild(button);
    return button;
  }

  // 显示/隐藏面板
  function togglePanel() {
    const panel = document.getElementById("bili-stream-code-panel");
    if (!panel) return; // 理论上不会发生
    panel.style.display =
      panel.style.display === "none" || !panel.style.display ? "block" : "none";
  }

  // 检查浮动按钮
  function checkFloatButton() {
    if (!document.getElementById("bili-stream-float-button")) {
      createFloatButton();
    }
  }

  // 全局 loadAreaList 函数已移除，其功能由 createAreaSelection 内的 loadAndBindAreaList 处理

  // 显示分区加载错误信息
  function showAreaLoadError() {
    const loading = document.getElementById("bili-area-loading");
    if (loading) {
      loading.textContent = "无法加载分区列表，请稍后刷新重试";
      loading.style.color = "#ff4b4b";
    }

    // 显示通知
    GM_notification({
      text: "无法加载直播分区列表，请检查网络连接或登录状态",
      title: "B站推流码获取工具",
      timeout: 5000,
    });
  }

  // 更新分区选择器
  function updateAreaSelectors(areaList) {
    const loading = document.getElementById("bili-area-loading");
    const groupSelect = document.getElementById("bili-area-group");
    const areaSelect = document.getElementById("bili-area");
    // 防止 loading 取不到时报错
    if (!loading || !groupSelect || !areaSelect) return;

    // 隐藏加载提示
    loading.style.display = "none";

    // 显示选择器
    groupSelect.style.display = "block";
    areaSelect.style.display = "block";

    // 清空选择器
    groupSelect.innerHTML = "";
    areaSelect.innerHTML = "";

    // 添加分区大类
    areaList.forEach((group, index) => {
      const option = document.createElement("option");
      option.value = group.id;
      option.textContent = group.name;
      option.dataset.index = index;
      groupSelect.appendChild(option);
    });

    // 默认显示第一个分区大类的子分区
    if (areaList.length > 0 && areaList[0].list) {
      areaList[0].list.forEach((area) => {
        const option = document.createElement("option");
        option.value = area.id;
        option.textContent = area.name;
        areaSelect.appendChild(option);
      });
    }

    // 分区大类变更事件
    groupSelect.addEventListener("change", function () {
      const selectedIndex = this.options[this.selectedIndex].dataset.index;
      const selectedGroup = areaList[selectedIndex];

      // 清空子分区
      areaSelect.innerHTML = "";

      if (selectedGroup && selectedGroup.list) {
        selectedGroup.list.forEach((area) => {
          const option = document.createElement("option");
          option.value = area.id;
          option.textContent = area.name;
          areaSelect.appendChild(option);
        });
      }
    });
  }

  // 获取缓存的分区列表
  function getCachedAreaList() {
    const timeStamp = GM_getValue(STORAGE_KEYS.AREA_LIST_TIME);
    if (!timeStamp) return null;

    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    // 超过一天则认为过期
    if (now - timeStamp > oneDay) return null;

    const listStr = GM_getValue(STORAGE_KEYS.AREA_LIST);
    if (!listStr) return null;

    try {
      return JSON.parse(listStr);
    } catch (e) {
      return null;
    }
  }

  // 缓存分区列表
  function cacheAreaList(areaList) {
    GM_setValue(STORAGE_KEYS.AREA_LIST, JSON.stringify(areaList));
    GM_setValue(STORAGE_KEYS.AREA_LIST_TIME, new Date().getTime());
  }

  // 拆分 autoFillRoomId 内部逻辑
  function getRoomIdFromUrl() {
    const urlMatch = window.location.href.match(/live\.bilibili\.com\/(\d+)/);
    return urlMatch && urlMatch[1] ? urlMatch[1] : null;
  }
  function getRoomIdFromElement() {
    const roomElement = document.querySelector(".room-info-anchor-name");
    if (roomElement) {
      const href = roomElement.getAttribute("href");
      if (href) {
        const match = href.match(/\/(\d+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
    return null;
  }
  function getRoomIdFromHistory() {
    return GM_getValue(STORAGE_KEYS.LAST_ROOM_ID);
  }
  function getCsrfToken() {
    const csrfCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("bili_jct="));
    return csrfCookie ? csrfCookie.split("=")[1] : null;
  }
  function autoFillRoomId() {
    const lastRoomId = GM_getValue(STORAGE_KEYS.LAST_ROOM_ID);
    const lastAreaId = GM_getValue(STORAGE_KEYS.LAST_AREA_ID);
    const lastTitle = GM_getValue(STORAGE_KEYS.LAST_TITLE);
    if (streamInfo && streamInfo.roomId) {
      document.getElementById("bili-room-id").value = streamInfo.roomId;
      roomId = streamInfo.roomId;
      if (document.getElementById("bili-title") && streamInfo.title) {
        document.getElementById("bili-title").value = streamInfo.title;
      }
    } else {
      let foundRoomId = getRoomIdFromUrl() || getRoomIdFromElement();
      if (!foundRoomId && window.location.href.includes("space.bilibili.com")) {
        const midMatch = window.location.href.match(
          /space\.bilibili\.com\/(\d+)/
        );
        if (midMatch && midMatch[1]) {
          GM_setValue(STORAGE_KEYS.USER_MID, midMatch[1]);
        }
      }
      if (!foundRoomId) {
        foundRoomId = getRoomIdFromHistory();
      }
      if (foundRoomId) {
        document.getElementById("bili-room-id").value = foundRoomId;
        roomId = foundRoomId;
        GM_setValue(STORAGE_KEYS.LAST_ROOM_ID, foundRoomId);
      } else if (lastRoomId) {
        document.getElementById("bili-room-id").value = lastRoomId;
        roomId = lastRoomId;
      }
    }
    if (document.getElementById("bili-title") && lastTitle) {
      document.getElementById("bili-title").value = lastTitle;
    }
    // 移除 setTimeout，因为现在依赖 Promise
    // setTimeout(() => {
    if (lastAreaId) {
      const areaSelect = document.getElementById("bili-area");
      if (areaSelect) {
        for (let i = 0; i < areaSelect.options.length; i++) {
          if (areaSelect.options[i].value == lastAreaId) {
            areaSelect.selectedIndex = i;
            break;
          }
        }
      }
    }
    // }, 500);
    csrf = getCsrfToken();
  }

  // 恢复直播状态
  function restoreLiveState() {
    if (isLiveStarted && streamInfo) {
      setTimeout(() => {
        const panel = document.getElementById("bili-stream-code-panel");
        if (panel) {
          // 不再自动展开面板，只恢复按钮和推流信息
          // panel.style.display = 'block';
          // 更新按钮状态
          updateButtonsForLive(true);
          // 恢复推流信息
          restoreStreamInfo();
        }
      }, 500);
    }
  }

  // 推流信息区输入框和按钮也用 class
  function restoreStreamInfo() {
    if (!streamInfo) return;
    const resultArea = document.getElementById("bili-result");
    if (!resultArea) return;
    const rtmpAddr = streamInfo.rtmpAddr;
    const rtmpCode = streamInfo.rtmpCode;

    const resultHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <h3 class="bili-title" style="font-size: 16px;">推流信息 (进行中)</h3>
                <div>
                    <p style="margin: 0; font-weight: bold;">服务器地址:</p>
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input id="server-addr" readonly value="${rtmpAddr}" title="${rtmpAddr}" class="bili-input" />
                        <button id="copy-addr" class="bili-copy-btn">复制</button>
                    </div>
                    <p style="margin: 0; font-weight: bold;">推流码:</p>
                    <div style="display: flex; align-items: center;">
                        <input id="stream-code" readonly value="${rtmpCode}" title="${rtmpCode}" class="bili-input" />
                        <button id="copy-code" class="bili-copy-btn">复制</button>
                    </div>
                </div>
                <div class="bili-important-tip">
                    <p style="margin: 0; font-weight: bold;">重要提示:</p>
                    <p style="margin: 3px 0 0; font-size: 13px;">1. 长时间无信号会自动关闭直播</p>
                    <p style="margin: 3px 0 0; font-size: 13px;">2. 推流码如果变动会有提示</p>
                </div>
            </div>
        `;

    resultArea.innerHTML = resultHTML;
    resultArea.style.display = "block";
    // 添加复制按钮事件
    const copyAddrBtn = document.getElementById("copy-addr");
    if (copyAddrBtn) {
      copyAddrBtn.addEventListener("click", function () {
        copyToClipboardWithButton(rtmpAddr, copyAddrBtn);
      });
    }
    const copyCodeBtn = document.getElementById("copy-code");
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener("click", function () {
        copyToClipboardWithButton(rtmpCode, copyCodeBtn);
      });
    }
    // 新增：推流信息区插入后，重新应用颜色模式
    const isDarkMode = GM_getValue("bili_dark_mode", false);
    applyColorMode(isDarkMode);
  }

  // 更新按钮状态（开始/结束直播）
  function updateButtonsForLive(isLive) {
    if (startLiveButton) {
      startLiveButton.disabled = isLive;
    }
    // 只要 roomId 有效（非空字符串），就允许结束直播按钮可用
    if (stopLiveButton) {
      stopLiveButton.disabled = !(roomId && String(roomId).trim() !== "");
    }
  }

  // 恢复直播状态
  function restoreLiveState() {
    if (isLiveStarted && streamInfo) {
      setTimeout(() => {
        const panel = document.getElementById("bili-stream-code-panel");
        if (panel) {
          // 不再自动展开面板，只恢复按钮和推流信息
          // panel.style.display = 'block';
          // 更新按钮状态
          updateButtonsForLive(true);
          // 恢复推流信息
          restoreStreamInfo();
        }
      }, 500);
    }
  }

  // 推流信息区输入框和按钮也用 class
  function restoreStreamInfo() {
    if (!streamInfo) return;
    const resultArea = document.getElementById("bili-result");
    if (!resultArea) return;
    const rtmpAddr = streamInfo.rtmpAddr;
    const rtmpCode = streamInfo.rtmpCode;

    const resultHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <h3 class="bili-title" style="font-size: 16px;">推流信息 (进行中)</h3>
                <div>
                    <p style="margin: 0; font-weight: bold;">服务器地址:</p>
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input id="server-addr" readonly value="${rtmpAddr}" title="${rtmpAddr}" class="bili-input" />
                        <button id="copy-addr" class="bili-copy-btn">复制</button>
                    </div>
                    <p style="margin: 0; font-weight: bold;">推流码:</p>
                    <div style="display: flex; align-items: center;">
                        <input id="stream-code" readonly value="${rtmpCode}" title="${rtmpCode}" class="bili-input" />
                        <button id="copy-code" class="bili-copy-btn">复制</button>
                    </div>
                </div>
                <div class="bili-important-tip">
                    <p style="margin: 0; font-weight: bold;">重要提示:</p>
                    <p style="margin: 3px 0 0; font-size: 13px;">1. 长时间无信号会自动关闭直播</p>
                    <p style="margin: 3px 0 0; font-size: 13px;">2. 推流码如果变动会有提示</p>
                </div>
            </div>
        `;

    resultArea.innerHTML = resultHTML;
    resultArea.style.display = "block";
    // 添加复制按钮事件
    const copyAddrBtn = document.getElementById("copy-addr");
    if (copyAddrBtn) {
      copyAddrBtn.addEventListener("click", function () {
        copyToClipboardWithButton(rtmpAddr, copyAddrBtn);
      });
    }
    const copyCodeBtn = document.getElementById("copy-code");
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener("click", function () {
        copyToClipboardWithButton(rtmpCode, copyCodeBtn);
      });
    }
    // 新增：推流信息区插入后，重新应用颜色模式
    const isDarkMode = GM_getValue("bili_dark_mode", false);
    applyColorMode(isDarkMode);
  }

  // 更新按钮状态（用于直播开始/结束）
  function updateButtonsForLive(isLive) {
    if (isLive) {
      // 直播开始状态
      if (startLiveButton) {
        startLiveButton.disabled = true;
        startLiveButton.style.opacity = "0.5";
      }

      if (stopLiveButton) {
        stopLiveButton.disabled = false;
        stopLiveButton.style.opacity = "1";
        stopLiveButton.style.backgroundColor = "#ff4b4b";
      }
    } else {
      // 直播结束状态
      if (startLiveButton) {
        startLiveButton.disabled = false;
        startLiveButton.style.opacity = "1";
      }

      if (stopLiveButton) {
        stopLiveButton.disabled = true;
        stopLiveButton.style.opacity = "0.5";
        stopLiveButton.style.backgroundColor = "#999";
      }
    }
  }

  // 开始直播
  async function startLive() {
    // Make startLive async
    // 获取输入值
    roomId = document.getElementById("bili-room-id").value.trim();
    const areaId = document.getElementById("bili-area").value;
    const liveTitle = document.getElementById("bili-title").value.trim();

    // 验证输入
    if (!roomId) {
      showMessage("请输入房间ID", true);
      return;
    }

    if (!liveTitle) {
      showMessage("请输入直播标题", true);
      return;
    }

    if (!csrf) {
      showMessage("无法获取CSRF令牌，请确保已登录B站", true);
      return;
    }

    // 更新直播标题
    // updateLiveTitle(roomId, liveTitle, (success) => { // Original callback structure
    //   if (!success) {
    //     showMessage(
    //       "设置直播标题失败，请确认是否已登录或有权限修改此直播间",
    //       true
    //     );
    //     return;
    //   }

    //   // 设置请求参数
    //   startData.room_id = roomId;
    //   startData.csrf_token = csrf;
    //   startData.csrf = csrf;
    //   startData.area_v2 = areaId;

    //   // 获取推流码
    //   showMessage("正在获取推流码...");

    //   GM_xmlhttpRequest({
    //     method: "POST",
    //     url: API_URL_START_LIVE, // Replaced
    //     headers: headers,
    //     data: new URLSearchParams(startData).toString(),
    //     onload: function (response) {
    //       try {
    //         const result = JSON.parse(response.responseText);

    //         if (result.code === 0) {
    //           // 成功获取
    //           handleStartLiveSuccess(result.data, liveTitle, areaId);
    //         } else {
    //           console.error("Start live API error:", result); // Added
    //           showMessage(
    //             `获取推流码失败: ${result.message || "未知错误"}`,
    //             true
    //           );
    //         }
    //       } catch (error) {
    //         console.error(
    //           "Error parsing start live response:",
    //           error,
    //           "Response text:",
    //           response.responseText
    //         ); // Enhanced
    //         showMessage("解析响应失败，请稍后重试", true);
    //       }
    //     },
    //     onerror: function (response) {
    //       // Changed 'error' to 'response' to match GM_xmlhttpRequest
    //       console.error("Start live request error:", response); // Added
    //       showMessage("网络请求失败，请检查网络连接", true);
    //     },
    //   });
    // });

    try {
      const titleUpdated = await updateLiveTitle(roomId, liveTitle);
      if (!titleUpdated) {
        showMessage(
          "设置直播标题失败，请确认是否已登录或有权限修改此直播间",
          true
        );
        return;
      }

      // 设置请求参数
      startData.room_id = roomId;
      startData.csrf_token = csrf;
      startData.csrf = csrf;
      startData.area_v2 = areaId;

      // 获取推流码
      showMessage("正在获取推流码...");

      const startLiveResponse = await gmRequest({
        method: "POST",
        url: API_URL_START_LIVE,
        headers: headers,
        data: new URLSearchParams(startData).toString(),
      });

      const startLiveResult = JSON.parse(startLiveResponse.responseText);

      if (startLiveResult.code === 0) {
        // 成功获取
        handleStartLiveSuccess(startLiveResult.data, liveTitle, areaId);
      } else {
        console.error("Start live API error:", startLiveResult);
        showMessage(
          `获取推流码失败: ${startLiveResult.message || "未知错误"}`,
          true
        );
      }
    } catch (errorResponse) {
      console.error("API request failed in startLive:", errorResponse);
      let errorMessage = "网络请求失败或解析错误";
      if (errorResponse && errorResponse.responseText) {
        try {
          const parsedError = JSON.parse(errorResponse.responseText);
          errorMessage = `API错误: ${parsedError.message || "未知API错误"}`;
        } catch (e) {
          // Ignore if responseText is not JSON
        }
      } else if (errorResponse instanceof Error) {
        errorMessage = `请求错误: ${errorResponse.message}`;
      }
      showMessage(errorMessage, true);
    }
  }

  // 处理开始直播成功
  function handleStartLiveSuccess(data, title, areaId) {
    const rtmpAddr = data.rtmp.addr;
    const rtmpCode = data.rtmp.code;

    // 新增：保存本次推流信息到本地用于下次对比
    GM_setValue("bili_last_rtmp_addr", rtmpAddr);
    GM_setValue("bili_last_rtmp_code", rtmpCode);

    // 检查上次推流信息是否有变动
    let changeTip = "";
    const prevAddr = GM_getValue("bili_prev_rtmp_addr");
    const prevCode = GM_getValue("bili_prev_rtmp_code");
    if (prevAddr && prevCode) {
      if (prevAddr !== rtmpAddr || prevCode !== rtmpCode) {
        changeTip = `<div class=\"bili-tip-yellow\"><span style=\"font-weight:bold;\">注意：</span>本次推流信息与上次不同，请确认已更新到OBS等推流软件！</div>`;
      } else {
        changeTip = `<div class=\"bili-tip-green\"><span style=\"font-weight:bold;\">推流信息没有变动 🎉🎉</span></div>`;
      }
    }
    // 更新本地上次推流信息为本次
    GM_setValue("bili_prev_rtmp_addr", rtmpAddr);
    GM_setValue("bili_prev_rtmp_code", rtmpCode);

    // 显示推流信息
    const resultHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <h3 class="bili-title" style="font-size: 16px;">推流信息</h3>
                <div>
                    <p style="margin: 0; font-weight: bold;">服务器地址:</p>
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input id="server-addr" readonly value="${rtmpAddr}" title="${rtmpAddr}" class="bili-input" />
                        <button id="copy-addr" class="bili-copy-btn">复制</button>
                    </div>
                    <p style="margin: 0; font-weight: bold;">推流码:</p>
                    <div style="display: flex; align-items: center;">
                        <input id="stream-code" readonly value="${rtmpCode}" title="${rtmpCode}" class="bili-input" />
                        <button id="copy-code" class="bili-copy-btn">复制</button>
                    </div>
                </div>
                ${changeTip}
                <div class="bili-important-tip">
                    <p style="margin: 0; font-weight: bold;">重要提示:</p>
                    <p style="margin: 3px 0 0; font-size: 13px;">1. 长时间无信号会自动关闭直播</p>
                    <p style="margin: 3px 0 0; font-size: 13px;">2. 推流码如果变动会有提示</p>
                </div>
            </div>
        `;

    const resultArea = document.getElementById("bili-result");
    resultArea.innerHTML = resultHTML;
    resultArea.style.display = "block";
    // 添加复制按钮事件
    const copyAddrBtn = document.getElementById("copy-addr");
    if (copyAddrBtn) {
      copyAddrBtn.addEventListener("click", function () {
        copyToClipboardWithButton(rtmpAddr, copyAddrBtn);
      });
    }
    const copyCodeBtn = document.getElementById("copy-code");
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener("click", function () {
        copyToClipboardWithButton(rtmpCode, copyCodeBtn);
      });
    }
    // 新增：推流信息区插入后，重新应用颜色模式
    const isDarkMode = GM_getValue("bili_dark_mode", false);
    applyColorMode(isDarkMode);

    // 更新按钮状态
    updateButtonsForLive(true);

    // 保存直播状态
    isLiveStarted = true;
    streamInfo = {
      rtmpAddr,
      rtmpCode,
      roomId,
      areaId,
      title,
    };

    GM_setValue("isLiveStarted", true);
    GM_setValue("streamInfo", streamInfo);

    // 显示通知
    GM_notification({
      text: "已成功获取推流码并开始直播",
      title: "B站推流码获取工具",
      timeout: 5000,
    });
  }

  // 更新直播标题
  async function updateLiveTitle(roomId, title) {
    // Removed callback, make async
    titleData.room_id = roomId;
    titleData.title = title;
    titleData.csrf_token = csrf;
    titleData.csrf = csrf;

    // GM_xmlhttpRequest({ // Original GM_xmlhttpRequest call
    //   method: "POST",
    //   url: API_URL_UPDATE_ROOM, // Replaced
    //   headers: headers,
    //   data: new URLSearchParams(titleData).toString(),
    //   onload: function (response) {
    //     try {
    //       const result = JSON.parse(response.responseText);
    //       if (result.code !== 0) {
    //         // Added condition for logging
    //         console.error("Update title API error:", result); // Added
    //       }
    //       callback(result.code === 0);
    //     } catch (error) {
    //       console.error(
    //         "Error parsing update title response:",
    //         error,
    //         "Response text:",
    //         response.responseText
    //       ); // Enhanced
    //       callback(false);
    //     }
    //   },
    //   onerror: function (response) {
    //     // Changed 'error' to 'response' to match GM_xmlhttpRequest
    //     console.error("Update title request error:", response); // Added
    //     callback(false);
    //   },
    // });
    try {
      const response = await gmRequest({
        method: "POST",
        url: API_URL_UPDATE_ROOM,
        headers: headers,
        data: new URLSearchParams(titleData).toString(),
      });
      const result = JSON.parse(response.responseText);
      if (result.code !== 0) {
        console.error("Update title API error:", result);
      }
      return result.code === 0;
    } catch (errorResponse) {
      console.error("Update title request error:", errorResponse);
      return false;
    }
  }

  // 停止直播
  async function stopLive() {
    // Make stopLive async
    if (!isLiveStarted) return;

    if (!confirm("确定要结束直播吗？")) return;

    // 设置请求参数
    stopData.room_id = roomId;
    stopData.csrf_token = csrf;
    stopData.csrf = csrf;

    // GM_xmlhttpRequest({ // Original GM_xmlhttpRequest call
    //   method: "POST",
    //   url: API_URL_STOP_LIVE, // Replaced
    //   headers: headers,
    //   data: new URLSearchParams(stopData).toString(),
    //   onload: function (response) {
    //     try {
    //       const result = JSON.parse(response.responseText);

    //       if (result.code === 0) {
    //         // 成功结束直播
    //         showMessage("直播已成功结束");

    //         // 更新按钮状态
    //         updateButtonsForLive(false);

    //         // 清除直播状态
    //         isLiveStarted = false;
    //         streamInfo = null;

    //         GM_setValue("isLiveStarted", false);
    //         GM_setValue("streamInfo", null);
    //       } else {
    //         console.error("Stop live API error:", result); // Added
    //         showMessage(`结束直播失败: ${result.message || "未知错误"}`, true);
    //       }
    //     } catch (error) {
    //       console.error(
    //         "Error parsing stop live response:",
    //         error,
    //         "Response text:",
    //         response.responseText
    //       ); // Enhanced
    //       showMessage("解析响应失败，请稍后重试", true);
    //     }
    //   },
    //   onerror: function (response) {
    //     // Changed 'error' to 'response' to match GM_xmlhttpRequest
    //     console.error("Stop live request error:", response); // Added
    //     showMessage("网络请求失败，请检查网络连接", true);
    //   },
    // });
    try {
      const response = await gmRequest({
        method: "POST",
        url: API_URL_STOP_LIVE,
        headers: headers,
        data: new URLSearchParams(stopData).toString(),
      });
      const result = JSON.parse(response.responseText);

      if (result.code === 0) {
        // 成功结束直播
        showMessage("直播已成功结束");

        // 更新按钮状态
        updateButtonsForLive(false);

        // 清除直播状态
        isLiveStarted = false;
        streamInfo = null;

        GM_setValue("isLiveStarted", false);
        GM_setValue("streamInfo", null);
      } else {
        console.error("Stop live API error:", result);
        showMessage(`结束直播失败: ${result.message || "未知错误"}`, true);
      }
    } catch (errorResponse) {
      console.error("Stop live request error:", errorResponse);
      let errorMessage = "网络请求失败或解析错误";
      if (errorResponse && errorResponse.responseText) {
        try {
          const parsedError = JSON.parse(errorResponse.responseText);
          errorMessage = `API错误: ${parsedError.message || "未知API错误"}`;
        } catch (e) {
          // Ignore if responseText is not JSON
        }
      } else if (errorResponse instanceof Error) {
        errorMessage = `请求错误: ${errorResponse.message}`;
      }
      showMessage(errorMessage, true);
    }
  }

  // 显示消息
  function showMessage(message, isError = false) {
    const resultArea = document.getElementById("bili-result");
    if (resultArea) {
      resultArea.innerHTML = `<p class="bili-message${
        isError ? " bili-message-error" : ""
      }">${message}</p>`;
      resultArea.style.display = "block";
    }

    GM_notification({
      text: message,
      title: isError ? "错误" : "B站推流码获取工具",
      timeout: 5000,
    });
  }

  // 复制到剪贴板
  function copyToClipboard(text) {
    GM_setClipboard(text);
    showMessage("已复制到剪贴板");
  }

  // 复制到剪贴板（按钮变✅，不弹窗）
  function copyToClipboardWithButton(text, btn) {
    GM_setClipboard(text);
    if (!btn) return;
    const oldText = btn.textContent;
    btn.textContent = "✅";
    btn.disabled = true;
    btn.classList.add("bili-copy-btn");
    setTimeout(() => {
      btn.textContent = oldText;
      btn.disabled = false;
      btn.classList.add("bili-copy-btn");
    }, 2000);
  }

  // 页面导航事件监听
  window.addEventListener("popstate", init);
  window.addEventListener("hashchange", init);

  // 监听页面可见性变化，页面可见时检查浮动按钮
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      checkFloatButton();
    }
  });

  // 使用MutationObserver监听DOM变化，动态检查浮动按钮
  const observer = new MutationObserver(function () {
    checkFloatButton();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 初始加载
  setTimeout(init, 500);
})();
