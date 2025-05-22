// ==UserScript==
// @name         B站推流码获取工具
// @namespace    https://github.com/smathsp
// @version      1
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
// @grant        unsafeWindow
// @connect      api.live.bilibili.com
// @connect      passport.bilibili.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 全局变量
    let roomId = null; // 当前房间ID
    let csrf = null; // CSRF令牌
    let startLiveButton = null; // “开始直播”按钮引用
    let stopLiveButton = null; // “结束直播”按钮引用
    let isLiveStarted = GM_getValue('isLiveStarted', false); // 直播状态
    let streamInfo = GM_getValue('streamInfo', null); // 推流信息缓存

    // 请求头
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'origin': 'https://link.bilibili.com',
        'referer': 'https://link.bilibili.com/p/center/index',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    // 开始直播数据模板
    const startData = {
        'room_id': '',
        'platform': 'android_link',
        'area_v2': '',
        'backup_stream': '0',
        'csrf_token': '',
        'csrf': '',
    };

    // 停止直播数据模板
    const stopData = {
        'room_id': '',
        'platform': 'android_link',
        'csrf_token': '',
        'csrf': '',
    };

    // 修改直播标题数据模板
    const titleData = {
        'room_id': '',
        'platform': 'android_link',
        'title': '',
        'csrf_token': '',
        'csrf': '',
    };

    // 初始化入口
    function init() {
        try {
            removeExistingComponents(); // 清理旧组件
            createUI(); // 创建UI
            restoreLiveState(); // 恢复直播状态
            setInterval(checkFloatButton, 5000); // 定期检查浮动按钮
        } catch (error) {
            console.error("B站推流码获取工具初始化失败:", error);
        }
    }
    
    // 移除已存在的组件
    function removeExistingComponents() {
        const existingPanel = document.getElementById('bili-stream-code-panel');
        if (existingPanel) existingPanel.remove();
        
        const existingButton = document.getElementById('bili-stream-float-button');
        if (existingButton) existingButton.remove();
    }

    // 创建UI
    function createUI() {
        // 创建主面板
        const panel = createPanel();
        
        // 创建浮动按钮
        createFloatButton();
        
        // 自动填充房间ID
        setTimeout(autoFillRoomId, 300);
    }
    
    // 创建面板
    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'bili-stream-code-panel';
        panel.style.cssText = `
            position: fixed;
            top: 70px;
            right: 10px;
            width: 300px;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            padding: 15px;
            font-family: "Microsoft YaHei", sans-serif;
            display: none;
        `;
        
        // 头部区域
        const header = createPanelHeader();
        panel.appendChild(header);
        
        // 表单区域
        const form = createPanelForm();
        panel.appendChild(form);
        
        // 结果区域
        const resultArea = document.createElement('div');
        resultArea.id = 'bili-result';
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
        return panel;
    }
    
    // 创建面板头部
    function createPanelHeader() {
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;';
        
        // 标题
        const title = document.createElement('h2');
        title.textContent = 'B站推流码获取工具';
        title.style.cssText = 'margin: 0; color: #fb7299; font-size: 18px;';
        
        // 关闭按钮
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '<svg viewBox="0 0 1024 1024" width="16" height="16"><path d="M512 421.49 331.09 240.58c-24.74-24.74-64.54-24.71-89.28 0.03-24.74 24.74-24.72 64.54 0.03 89.28L422.75 510.8 241.84 691.71c-24.74 24.74-24.72 64.54 0.03 89.33 24.74 24.74 64.54 24.71 89.28-0.03L512 600.1l180.91 180.91c24.74 24.74 64.54 24.71 89.28-0.03 24.74-24.74 24.72-64.54-0.03-89.28L601.25 510.8 782.16 329.89c24.74-24.74 24.72-64.54-0.03-89.33-24.74-24.74-64.54-24.71-89.28 0.03L512 421.49z" fill="#888888"></path></svg>';
        closeButton.style.cssText = 'width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center;';
        closeButton.onclick = () => {
            document.getElementById('bili-stream-code-panel').style.display = 'none';
        };
        
        header.appendChild(title);
        header.appendChild(closeButton);
        return header;
    }
    
    // 创建面板表单
    function createPanelForm() {
        const form = document.createElement('div');
        form.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
        
        // 房间ID输入
        form.appendChild(createRoomIdInput());
        
        // 分区选择
        form.appendChild(createAreaSelection());
        
        // 标题输入
        form.appendChild(createTitleInput());
        
        // 按钮组
        form.appendChild(createButtonGroup());
        
        return form;
    }
    
    // 创建房间ID输入
    function createRoomIdInput() {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
        
        const label = document.createElement('label');
        label.textContent = '房间ID (Room ID):';
        label.style.cssText = 'font-size: 14px; color: #666;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'bili-room-id';
        input.placeholder = '请输入你的房间ID';
        input.style.cssText = 'padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;';
        // 新增：输入时保存
        input.addEventListener('input', function() {
            GM_setValue('bili_last_roomid', input.value.trim());
        });
        
        container.appendChild(label);
        container.appendChild(input);
        
        return container;
    }
    
    // 创建分区选择
    function createAreaSelection() {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
        
        const label = document.createElement('label');
        label.textContent = '直播分区:';
        label.style.cssText = 'font-size: 14px; color: #666;';
        
        // 加载指示器
        const loading = document.createElement('div');
        loading.id = 'bili-area-loading';
        loading.textContent = '正在加载分区列表...';
        loading.style.cssText = 'padding: 8px; color: #666; font-size: 14px; text-align: center; cursor: pointer;';
        
        // 分区组选择器
        const groupSelect = document.createElement('select');
        groupSelect.id = 'bili-area-group';
        groupSelect.style.cssText = 'padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; margin-bottom: 8px; display: none;';
        // 新增：切换大类时保存
        groupSelect.addEventListener('change', function() {
            const areaList = getCachedAreaList() || [];
            const selectedIndex = this.options[this.selectedIndex].dataset.index;
            // 保存大类id
            GM_setValue('bili_last_groupid', groupSelect.value);
            refreshAreaOptions(areaList, Number(selectedIndex));
        });
        
        // 子分区选择器
        const areaSelect = document.createElement('select');
        areaSelect.id = 'bili-area';
        areaSelect.style.cssText = 'padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; display: none;';
        // 新增：选择分区时保存
        areaSelect.addEventListener('change', function() {
            GM_setValue('bili_last_areaid', areaSelect.value);
            // 同步保存大类id，保证切换子分区时也能恢复
            GM_setValue('bili_last_groupid', groupSelect.value);
        });
        
        container.appendChild(label);
        container.appendChild(loading);
        container.appendChild(groupSelect);
        container.appendChild(areaSelect);
        
        // 分区数据加载与联动
        function refreshAreaOptions(areaList, groupIdx = 0) {
            groupSelect.innerHTML = '';
            areaSelect.innerHTML = '';
            areaList.forEach((group, idx) => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                option.dataset.index = idx;
                groupSelect.appendChild(option);
            });
            // 新增：优先恢复上次大类
            const lastGroupId = GM_getValue('bili_last_groupid');
            if (lastGroupId) {
                for (let i = 0; i < groupSelect.options.length; i++) {
                    if (groupSelect.options[i].value == lastGroupId) {
                        groupSelect.selectedIndex = i;
                        groupIdx = i;
                        break;
                    }
                }
            }
            if (areaList[groupIdx] && areaList[groupIdx].list) {
                areaList[groupIdx].list.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area.id;
                    option.textContent = area.name;
                    areaSelect.appendChild(option);
                });
            }
            // 新增：自动选中上次保存的分区id
            const lastAreaId = GM_getValue('bili_last_areaid');
            if (lastAreaId && areaSelect.options.length > 0) {
                for (let i = 0; i < areaSelect.options.length; i++) {
                    if (areaSelect.options[i].value == lastAreaId) {
                        areaSelect.selectedIndex = i;
                        break;
                    }
                }
            }
        }

        // 加载分区数据
        function loadAndBindAreaList() {
            loading.style.display = 'block';
            groupSelect.style.display = 'none';
            areaSelect.style.display = 'none';
            loading.textContent = '正在加载分区列表...';
            loading.style.color = '#666';
            // 先尝试从缓存加载
            const cachedList = getCachedAreaList();
            if (cachedList) {
                loading.style.display = 'none';
                groupSelect.style.display = 'block';
                areaSelect.style.display = 'block';
                refreshAreaOptions(cachedList);
                return;
            }
            // 从API获取
            GM_xmlhttpRequest({
                method: "GET",
                url: "https://api.live.bilibili.com/room/v1/Area/getList?show_pinyin=1",
                headers: headers,
                onload: function(response) {
                    try {
                        const result = JSON.parse(response.responseText);
                        if (result.code === 0) {
                            cacheAreaList(result.data);
                            loading.style.display = 'none';
                            groupSelect.style.display = 'block';
                            areaSelect.style.display = 'block';
                            refreshAreaOptions(result.data);
                        } else {
                            showAreaLoadError();
                        }
                    } catch (error) {
                        showAreaLoadError();
                    }
                },
                onerror: function() {
                    showAreaLoadError();
                }
            });
        }

        // 优化：点击加载失败提示可重试
        loading.addEventListener('click', function() {
            if (loading.style.color === 'rgb(255, 75, 75)' || loading.style.color === '#ff4b4b') {
                loadAndBindAreaList();
            }
        });

        // 绑定分区大类变更事件
        groupSelect.addEventListener('change', function() {
            const areaList = getCachedAreaList() || [];
            const selectedIndex = this.options[this.selectedIndex].dataset.index;
            refreshAreaOptions(areaList, Number(selectedIndex));
        });

        // 加载分区数据
        loadAndBindAreaList();

        return container;
    }
    
    // 创建标题输入
    function createTitleInput() {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
        
        const label = document.createElement('label');
        label.textContent = '直播标题:';
        label.style.cssText = 'font-size: 14px; color: #666;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'bili-title';
        input.placeholder = '请输入直播标题';
        input.style.cssText = 'padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;';
        // 新增：输入时保存
        input.addEventListener('input', function() {
            GM_setValue('bili_last_title', input.value.trim());
        });
        
        container.appendChild(label);
        container.appendChild(input);
        
        return container;
    }
    
    // 创建按钮组
    function createButtonGroup() {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; gap: 10px; margin-top: 10px;';
        
        // 开始直播按钮
        startLiveButton = document.createElement('button');
        startLiveButton.textContent = '获取推流码并开始直播';
        startLiveButton.style.cssText = `
            flex: 1;
            background-color: #fb7299;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
        `;
        startLiveButton.onmouseover = function() { this.style.backgroundColor = '#fc8bab'; };
        startLiveButton.onmouseout = function() { this.style.backgroundColor = '#fb7299'; };
        startLiveButton.onclick = startLive;
        
        // 结束直播按钮
        stopLiveButton = document.createElement('button');
        stopLiveButton.textContent = '结束直播';
        stopLiveButton.style.cssText = `
            flex: 1;
            background-color: #999;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
            opacity: 0.5;
        `;
        stopLiveButton.disabled = true;
        stopLiveButton.onmouseover = function() { if (!this.disabled) this.style.backgroundColor = '#777'; };
        stopLiveButton.onmouseout = function() { if (!this.disabled) this.style.backgroundColor = '#999'; };
        stopLiveButton.onclick = stopLive;
        
        container.appendChild(startLiveButton);
        container.appendChild(stopLiveButton);
        
        return container;
    }
    
    // 创建浮动按钮
    function createFloatButton() {
        const button = document.createElement('div');
        button.id = 'bili-stream-float-button';
        button.innerHTML = '<svg viewBox="0 0 1024 1024" width="24" height="24"><path d="M718.3 183.7H305.7c-122 0-221 99-221 221v214.6c0 122 99 221 221 221h412.6c122 0 221-99 221-221V404.7c0-122-99-221-221-221z m159.1 435.6c0 87.6-71.5 159.1-159.1 159.1H305.7c-87.6 0-159.1-71.5-159.1-159.1V404.7c0-87.6 71.5-159.1 159.1-159.1h412.6c87.6 0 159.1 71.5 159.1 159.1v214.6z" fill="#FFFFFF"></path><path d="M415.5 532.2v-131c0-7.1 3.8-13.6 10-17.1 6.2-3.5 13.7-3.5 19.9 0l131 75.1c6.2 3.5 10 10.1 10 17.1 0 7.1-3.8 13.6-10 17.1l-131 65.5c-6.2 3.5-13.7 3.5-19.9 0-6.2-3.5-10-10.1-10-17.1v-9.6z" fill="#FFFFFF"></path></svg>';
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
        button.onmouseover = function() { this.style.transform = 'scale(1.1)'; };
        button.onmouseout = function() { this.style.transform = 'scale(1)'; };
        button.onclick = togglePanel;
        
        document.body.appendChild(button);
        return button;
    }

    // 显示/隐藏面板
    function togglePanel() {
        let panel = document.getElementById('bili-stream-code-panel');
        if (!panel) {
            // 只创建面板，不重新初始化所有内容，避免浮动按钮事件丢失
            panel = createPanel();
            panel.style.display = 'block';
            // 自动填充房间ID
            setTimeout(autoFillRoomId, 300);
        } else {
            // 切换面板显示状态
            panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'block' : 'none';
        }
    }
    
    // 检查浮动按钮
    function checkFloatButton() {
        if (!document.getElementById('bili-stream-float-button')) {
            createFloatButton();
        }
    }

    // 加载直播分区列表
    function loadAreaList() {
        // 先尝试从缓存加载
        const cachedList = getCachedAreaList();
        if (cachedList) {
            updateAreaSelectors(cachedList);
            return;
        }
        
        // 从API获取
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://api.live.bilibili.com/room/v1/Area/getList?show_pinyin=1",
            headers: headers,
            onload: function(response) {
                try {
                    const result = JSON.parse(response.responseText);
                    if (result.code === 0) {
                        // 保存到缓存
                        cacheAreaList(result.data);
                        // 更新选择器
                        updateAreaSelectors(result.data);
                    } else {
                        loadDefaultAreas();
                    }
                } catch (error) {
                    showAreaLoadError();
                }
            },
            onerror: function() {
                showAreaLoadError();
            }
        });
    }
    
    // 显示分区加载错误信息
    function showAreaLoadError() {
        const loading = document.getElementById('bili-area-loading');
        if (loading) {
            loading.textContent = '无法加载分区列表，请稍后刷新重试';
            loading.style.color = '#ff4b4b';
        }
        
        // 显示通知
        GM_notification({
            text: '无法加载直播分区列表，请检查网络连接或登录状态',
            title: 'B站推流码获取工具',
            timeout: 5000
        });
    }
    
    // 更新分区选择器
    function updateAreaSelectors(areaList) {
        const loading = document.getElementById('bili-area-loading');
        const groupSelect = document.getElementById('bili-area-group');
        const areaSelect = document.getElementById('bili-area');
        // 防止 loading 取不到时报错
        if (!loading || !groupSelect || !areaSelect) return;
        
        // 隐藏加载提示
        loading.style.display = 'none';
        
        // 显示选择器
        groupSelect.style.display = 'block';
        areaSelect.style.display = 'block';
        
        // 清空选择器
        groupSelect.innerHTML = '';
        areaSelect.innerHTML = '';
        
        // 添加分区大类
        areaList.forEach((group, index) => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            option.dataset.index = index;
            groupSelect.appendChild(option);
        });
        
        // 默认显示第一个分区大类的子分区
        if (areaList.length > 0 && areaList[0].list) {
            areaList[0].list.forEach(area => {
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.name;
                areaSelect.appendChild(option);
            });
        }
        
        // 分区大类变更事件
        groupSelect.addEventListener('change', function() {
            const selectedIndex = this.options[this.selectedIndex].dataset.index;
            const selectedGroup = areaList[selectedIndex];
            
            // 清空子分区
            areaSelect.innerHTML = '';
            
            if (selectedGroup && selectedGroup.list) {
                selectedGroup.list.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area.id;
                    option.textContent = area.name;
                    areaSelect.appendChild(option);
                });
            }
        });
    }
    
    // 获取缓存的分区列表
    function getCachedAreaList() {
        const timeStamp = GM_getValue('bili_area_list_time');
        if (!timeStamp) return null;
        
        const now = new Date().getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        
        // 超过一天则认为过期
        if (now - timeStamp > oneDay) return null;
        
        const listStr = GM_getValue('bili_area_list');
        if (!listStr) return null;
        
        try {
            return JSON.parse(listStr);
        } catch (e) {
            return null;
        }
    }
    
    // 缓存分区列表
    function cacheAreaList(areaList) {
        GM_setValue('bili_area_list', JSON.stringify(areaList));
        GM_setValue('bili_area_list_time', new Date().getTime());
    }

    // 自动填充房间ID和获取CSRF
    function autoFillRoomId() {
        // 优先读取本地保存的上次填写内容
        const lastRoomId = GM_getValue('bili_last_roomid');
        const lastAreaId = GM_getValue('bili_last_areaid');
        const lastTitle = GM_getValue('bili_last_title');

        // 如果有保存的直播信息，优先使用
        if (streamInfo && streamInfo.roomId) {
            document.getElementById('bili-room-id').value = streamInfo.roomId;
            roomId = streamInfo.roomId;
            if (document.getElementById('bili-title') && streamInfo.title) {
                document.getElementById('bili-title').value = streamInfo.title;
            }
        } else {
            // 从网页中获取房间ID
            let foundRoomId = null;
            
            // 尝试从URL获取
            const urlMatch = window.location.href.match(/live\.bilibili\.com\/(\d+)/);
            if (urlMatch && urlMatch[1]) {
                foundRoomId = urlMatch[1];
            }
            
            // 尝试从页面元素获取
            if (!foundRoomId) {
                // 直播页面元素
                const roomElement = document.querySelector('.room-info-anchor-name');
                if (roomElement) {
                    const href = roomElement.getAttribute('href');
                    if (href) {
                        const match = href.match(/\/(\d+)/);
                        if (match && match[1]) {
                            foundRoomId = match[1];
                        }
                    }
                }
            }
            
            // 尝试从个人空间页面获取
            if (!foundRoomId && window.location.href.includes('space.bilibili.com')) {
                // 从个人空间获取用户ID
                const midMatch = window.location.href.match(/space\.bilibili\.com\/(\d+)/);
                if (midMatch && midMatch[1]) {
                    // 保存用户ID，以后可以用于API查询对应的房间号
                    GM_setValue('bili_user_mid', midMatch[1]);
                }
            }
            
            // 如果仍未找到且有历史记录，使用上次填写的房间ID
            if (!foundRoomId) {
                const lastRoomId = GM_getValue('bili_last_roomid');
                if (lastRoomId) {
                    foundRoomId = lastRoomId;
                }
            }
            
            if (foundRoomId) {
                document.getElementById('bili-room-id').value = foundRoomId;
                roomId = foundRoomId;
                // 保存最近使用的房间ID
                GM_setValue('bili_last_roomid', foundRoomId);
            } else if (lastRoomId) {
                document.getElementById('bili-room-id').value = lastRoomId;
                roomId = lastRoomId;
            }
        }
        // 标题自动填充
        if (document.getElementById('bili-title') && lastTitle) {
            document.getElementById('bili-title').value = lastTitle;
        }
        // 分区自动填充（需等分区下拉加载完成后设置）
        setTimeout(() => {
            if (lastAreaId) {
                const areaSelect = document.getElementById('bili-area');
                if (areaSelect) {
                    for (let i = 0; i < areaSelect.options.length; i++) {
                        if (areaSelect.options[i].value == lastAreaId) {
                            areaSelect.selectedIndex = i;
                            break;
                        }
                    }
                }
            }
        }, 500);
        // 获取CSRF令牌
        const csrfCookie = document.cookie.split('; ').find(row => row.startsWith('bili_jct='));
        if (csrfCookie) {
            csrf = csrfCookie.split('=')[1];
        }
    }

    // 恢复直播状态
    function restoreLiveState() {
        if (isLiveStarted && streamInfo) {
            setTimeout(() => {
                const panel = document.getElementById('bili-stream-code-panel');
                if (panel) {
                    // 显示面板
                    panel.style.display = 'block';
                    
                    // 更新按钮状态
                    updateButtonsForLive(true);
                    
                    // 恢复推流信息
                    restoreStreamInfo();
                }
            }, 500);
        }
    }
    
    // 恢复推流信息
    function restoreStreamInfo() {
        if (!streamInfo) return;
        const resultArea = document.getElementById('bili-result');
        if (!resultArea) return;
        const rtmpAddr = streamInfo.rtmpAddr;
        const rtmpCode = streamInfo.rtmpCode;
        
        const resultHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <h3 style="margin: 0; font-size: 16px; color: #fb7299;">推流信息 (进行中)</h3>
                <div>
                    <p style="margin: 0; font-weight: bold;">服务器地址:</p>
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input id="server-addr" readonly value="${rtmpAddr}" title="${rtmpAddr}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; overflow-x: auto; white-space: nowrap; background: #fff;" />
                        <button id="copy-addr" style="margin-left: 5px; background-color: #fb7299; color: white; border: none; border-radius: 4px; padding: 8px; cursor: pointer;">复制</button>
                    </div>
                    <p style="margin: 0; font-weight: bold;">推流码:</p>
                    <div style="display: flex; align-items: center;">
                        <input id="stream-code" readonly value="${rtmpCode}" title="${rtmpCode}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; overflow-x: auto; white-space: nowrap; background: #fff;" />
                        <button id="copy-code" style="margin-left: 5px; background-color: #fb7299; color: white; border: none; border-radius: 4px; padding: 8px; cursor: pointer;">复制</button>
                    </div>
                </div>
                <div style="margin-top: 8px; padding: 8px; background-color: #fef0f1; border-radius: 4px; border-left: 4px solid #fb7299;">
                    <p style="margin: 0; color: #d92b46; font-weight: bold;">重要提示:</p>
                    <p style="margin: 3px 0 0; font-size: 13px;">1. 您的直播正在进行中</p>
                    <p style="margin: 3px 0 0; font-size: 13px;">2. 点击"结束直播"按钮才会真正关闭直播</p>
                    <p style="margin: 3px 0 0; font-size: 13px;">3. 推流码仅可使用一次，再次直播需重新获取</p>
                </div>
            </div>
        `;
        
        resultArea.innerHTML = resultHTML;
        resultArea.style.display = 'block';
        // 添加复制按钮事件
        const copyAddrBtn = document.getElementById('copy-addr');
        if (copyAddrBtn) {
            copyAddrBtn.addEventListener('click', function() {
                copyToClipboardWithButton(rtmpAddr, copyAddrBtn);
            });
        }
        const copyCodeBtn = document.getElementById('copy-code');
        if (copyCodeBtn) {
            copyCodeBtn.addEventListener('click', function() {
                copyToClipboardWithButton(rtmpCode, copyCodeBtn);
            });
        }
    }
    
    // 更新按钮状态（用于直播开始/结束）
    function updateButtonsForLive(isLive) {
        if (isLive) {
            // 直播开始状态
            if (startLiveButton) {
                startLiveButton.disabled = true;
                startLiveButton.style.opacity = '0.5';
            }
            
            if (stopLiveButton) {
                stopLiveButton.disabled = false;
                stopLiveButton.style.opacity = '1';
                stopLiveButton.style.backgroundColor = '#ff4b4b';
            }
        } else {
            // 直播结束状态
            if (startLiveButton) {
                startLiveButton.disabled = false;
                startLiveButton.style.opacity = '1';
            }
            
            if (stopLiveButton) {
                stopLiveButton.disabled = true;
                stopLiveButton.style.opacity = '0.5';
                stopLiveButton.style.backgroundColor = '#999';
            }
        }
    }

    // 开始直播
    function startLive() {
        // 获取输入值
        roomId = document.getElementById('bili-room-id').value.trim();
        const areaId = document.getElementById('bili-area').value;
        const liveTitle = document.getElementById('bili-title').value.trim();
        
        // 验证输入
        if (!roomId) {
            showMessage('请输入房间ID', true);
            return;
        }
        
        if (!liveTitle) {
            showMessage('请输入直播标题', true);
            return;
        }
        
        if (!csrf) {
            showMessage('无法获取CSRF令牌，请确保已登录B站', true);
            return;
        }
        
        // 更新直播标题
        updateLiveTitle(roomId, liveTitle, (success) => {
            if (!success) {
                showMessage('设置直播标题失败，请确认是否已登录或有权限修改此直播间', true);
                return;
            }
            
            // 设置请求参数
            startData.room_id = roomId;
            startData.csrf_token = csrf;
            startData.csrf = csrf;
            startData.area_v2 = areaId;
            
            // 获取推流码
            showMessage('正在获取推流码...');
            
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://api.live.bilibili.com/room/v1/Room/startLive",
                headers: headers,
                data: new URLSearchParams(startData).toString(),
                onload: function(response) {
                    try {
                        const result = JSON.parse(response.responseText);
                        
                        if (result.code === 0) {
                            // 成功获取
                            handleStartLiveSuccess(result.data, liveTitle, areaId);
                        } else {
                            showMessage(`获取推流码失败: ${result.message || '未知错误'}`, true);
                        }
                    } catch (error) {
                        showMessage('解析响应失败，请稍后重试', true);
                    }
                },
                onerror: function() {
                    showMessage('网络请求失败，请检查网络连接', true);
                }
            });
        });
    }
    
    // 处理开始直播成功
    function handleStartLiveSuccess(data, title, areaId) {
        const rtmpAddr = data.rtmp.addr;
        const rtmpCode = data.rtmp.code;

        // 新增：保存本次推流信息到本地用于下次对比
        GM_setValue('bili_last_rtmp_addr', rtmpAddr);
        GM_setValue('bili_last_rtmp_code', rtmpCode);

        // 检查上次推流信息是否有变动
        let changeTip = '';
        const prevAddr = GM_getValue('bili_prev_rtmp_addr');
        const prevCode = GM_getValue('bili_prev_rtmp_code');
        if (prevAddr && prevCode) {
            if (prevAddr !== rtmpAddr || prevCode !== rtmpCode) {
                changeTip = `<div style=\"margin-top:8px;padding:8px;background:#fffbe6;border-left:4px solid #faad14;border-radius:4px;\"><span style=\"color:#faad14;font-weight:bold;\">注意：</span>本次推流信息与上次不同，请确认已更新到OBS等推流软件！</div>`;
            } else {
                changeTip = `<div style=\"margin-top:8px;padding:8px;background:#e6ffed;border-left:4px solid #52c41a;border-radius:4px;\"><span style=\"color:#389e0d;font-weight:bold;\">推流信息没有变动 🎉🎉</span></div>`;
            }
        }
        // 更新本地上次推流信息为本次
        GM_setValue('bili_prev_rtmp_addr', rtmpAddr);
        GM_setValue('bili_prev_rtmp_code', rtmpCode);

        // 显示推流信息
        const resultHTML = `
            <div style=\"display: flex; flex-direction: column; gap: 8px;\">
                <h3 style=\"margin: 0; font-size: 16px; color: #fb7299;\">推流信息</h3>
                <div>
                    <p style=\"margin: 0; font-weight: bold;\">服务器地址:</p>
                    <div style=\"display: flex; align-items: center; margin-bottom: 8px;\">
                        <input id=\"server-addr\" readonly value=\"${rtmpAddr}\" title=\"${rtmpAddr}\" style=\"flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; overflow-x: auto; white-space: nowrap; background: #fff;\" />
                        <button id=\"copy-addr\" style=\"margin-left: 5px; background-color: #fb7299; color: white; border: none; border-radius: 4px; padding: 8px; cursor: pointer;\">复制</button>
                    </div>
                    <p style=\"margin: 0; font-weight: bold;\">推流码:</p>
                    <div style=\"display: flex; align-items: center;\">
                        <input id=\"stream-code\" readonly value=\"${rtmpCode}\" title=\"${rtmpCode}\" style=\"flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; overflow-x: auto; white-space: nowrap; background: #fff;\" />
                        <button id=\"copy-code\" style=\"margin-left: 5px; background-color: #fb7299; color: white; border: none; border-radius: 4px; padding: 8px; cursor: pointer;\">复制</button>
                    </div>
                </div>
                ${changeTip}
                <div style=\"margin-top: 8px; padding: 8px; background-color: #fef0f1; border-radius: 4px; border-left: 4px solid #fb7299;\">
                    <p style=\"margin: 0; color: #d92b46; font-weight: bold;\">重要提示:</p>
                    <p style=\"margin: 3px 0 0; font-size: 13px;\">1. 长时间无信号会自动关闭直播</p>
                    <p style=\"margin: 3px 0 0; font-size: 13px;\">2. 推流码如果变动会有提示</p>
                </div>
            </div>
        `;
        
        const resultArea = document.getElementById('bili-result');
        resultArea.innerHTML = resultHTML;
        resultArea.style.display = 'block';
        // 添加复制按钮事件
        const copyAddrBtn = document.getElementById('copy-addr');
        if (copyAddrBtn) {
            copyAddrBtn.addEventListener('click', function() {
                copyToClipboardWithButton(rtmpAddr, copyAddrBtn);
            });
        }
        const copyCodeBtn = document.getElementById('copy-code');
        if (copyCodeBtn) {
            copyCodeBtn.addEventListener('click', function() {
                copyToClipboardWithButton(rtmpCode, copyCodeBtn);
            });
        }
        
        // 更新按钮状态
        updateButtonsForLive(true);
        
        // 保存直播状态
        isLiveStarted = true;
        streamInfo = {
            rtmpAddr,
            rtmpCode,
            roomId,
            areaId,
            title
        };
        
        GM_setValue('isLiveStarted', true);
        GM_setValue('streamInfo', streamInfo);
        
        // 显示通知
        GM_notification({
            text: '已成功获取推流码并开始直播',
            title: 'B站推流码获取工具',
            timeout: 5000
        });
    }

    // 更新直播标题
    function updateLiveTitle(roomId, title, callback) {
        titleData.room_id = roomId;
        titleData.title = title;
        titleData.csrf_token = csrf;
        titleData.csrf = csrf;
        
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://api.live.bilibili.com/room/v1/Room/update",
            headers: headers,
            data: new URLSearchParams(titleData).toString(),
            onload: function(response) {
                try {
                    const result = JSON.parse(response.responseText);
                    callback(result.code === 0);
                } catch (error) {
                    callback(false);
                }
            },
            onerror: function() {
                callback(false);
            }
        });
    }

    // 停止直播
    function stopLive() {
        if (!isLiveStarted) return;
        
        if (!confirm('确定要结束直播吗？')) return;
        
        // 设置请求参数
        stopData.room_id = roomId;
        stopData.csrf_token = csrf;
        stopData.csrf = csrf;
        
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://api.live.bilibili.com/room/v1/Room/stopLive",
            headers: headers,
            data: new URLSearchParams(stopData).toString(),
            onload: function(response) {
                try {
                    const result = JSON.parse(response.responseText);
                    
                    if (result.code === 0) {
                        // 成功结束直播
                        showMessage('直播已成功结束');
                        
                        // 更新按钮状态
                        updateButtonsForLive(false);
                        
                        // 清除直播状态
                        isLiveStarted = false;
                        streamInfo = null;
                        
                        GM_setValue('isLiveStarted', false);
                        GM_setValue('streamInfo', null);
                    } else {
                        showMessage(`结束直播失败: ${result.message || '未知错误'}`, true);
                    }
                } catch (error) {
                    showMessage('解析响应失败，请稍后重试', true);
                }
            },
            onerror: function() {
                showMessage('网络请求失败，请检查网络连接', true);
            }
        });
    }

    // 显示消息
    function showMessage(message, isError = false) {
        const resultArea = document.getElementById('bili-result');
        if (resultArea) {
            resultArea.innerHTML = `<p style="color: ${isError ? 'red' : '#333'}">${message}</p>`;
            resultArea.style.display = 'block';
        }
        
        GM_notification({
            text: message,
            title: isError ? '错误' : 'B站推流码获取工具',
            timeout: 5000
        });
    }

    // 复制到剪贴板
    function copyToClipboard(text) {
        GM_setClipboard(text);
        showMessage('已复制到剪贴板');
    }

    // 复制到剪贴板（按钮变✅，不弹窗）
    function copyToClipboardWithButton(text, btn) {
        GM_setClipboard(text);
        if (!btn) return;
        const oldText = btn.textContent;
        btn.textContent = '✅';
        btn.disabled = true;
        btn.style.backgroundColor = '#bfbfbf';
        setTimeout(() => {
            btn.textContent = oldText;
            btn.disabled = false;
            btn.style.backgroundColor = '#fb7299';
        }, 2000);
    }

    // 页面导航事件监听
    window.addEventListener('popstate', init);
    window.addEventListener('hashchange', init);
    
    // 监听页面可见性变化，页面可见时检查浮动按钮
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            checkFloatButton();
        }
    });
    
    // 使用MutationObserver监听DOM变化，动态检查浮动按钮
    const observer = new MutationObserver(function() {
        checkFloatButton();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // 多次尝试初始化，确保在各种情况下都能正常加载
    setTimeout(init, 500);
    setTimeout(checkFloatButton, 2000);
    setTimeout(checkFloatButton, 5000);
})();
