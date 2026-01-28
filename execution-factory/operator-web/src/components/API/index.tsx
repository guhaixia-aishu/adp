import { useEffect, useState } from 'react';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { Button, Tooltip } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import '@stoplight/elements/web-components.min.js';
import '@stoplight/elements/styles.min.css';
import { getConfig, getHttpBaseUrl } from '@/utils/http';
import { splitterStr, parsePathParams, parseQueryParams, transformToolInfoToOpenAPI, path2Hash } from './utils';
import styles from './index.module.less';

interface APIProps {
  toolInfo: any;
}

const API = ({ toolInfo }: APIProps) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    // 设置文档
    const docsElement = document.getElementById('docs');
    const toolSpec = transformToolInfoToOpenAPI(toolInfo);
    if (isEmpty(toolSpec)) {
      return;
    }

    docsElement.apiDescriptionDocument = toolSpec;
    docsElement.tryItCorsProxy = `${getHttpBaseUrl()}/api/agent-operator-integration/v1/tool-box/${toolInfo.box_id}/tool/${toolInfo.tool_id}/debug/api-web-proxy/${encodeURIComponent(`path=<${toolInfo.metadata?.path}>`)}`;

    const [path] = Object.keys(toolSpec.paths);
    if (path) {
      const method = Object.keys(toolSpec.paths[path])[0];
      const hash = path2Hash(path, method);
      // 设置hash
      location.hash = hash;
    }
  }, [toolInfo]);

  useEffect(() => {
    // 阻止stoplight-elements修改hash
    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = () => {};

    return () => {
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  useEffect(() => {
    // 拦截fetch请求，将stoplight-elements的请求代理到后端
    const originalFetch = window.fetch;
    window.fetch = (url: string, options = {}) => {
      if (/\/api\/agent-operator-integration\/v1\/tool-box\/(.*)\/tool\/(.*)\/debug\/api-web-proxy\//.test(url)) {
        const [targetUrl, apiUrl] = url.split(splitterStr);
        const path = parsePathParams(apiUrl);
        let body = options.body;
        try {
          body = JSON.parse(options.body);
        } catch {}
        const query = parseQueryParams(apiUrl);
        options.body = JSON.stringify({
          body,
          header: options.headers,
          ...(isEmpty(query) ? {} : { query }),
          ...(isEmpty(path) ? {} : { path }),
        });
        options.headers = {
          Authorization: 'Bearer ' + getConfig('getToken')(),
        };
        return originalFetch(targetUrl, options);
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [toolInfo]);

  // 切换全屏
  const toggleFullScreen = () => {
    setIsFullScreen(prev => !prev);
  };

  return (
    <div
      className={classNames(
        styles['container'],
        isFullScreen ? styles['fullscreen-container'] : styles['not-fullscreen-container']
      )}
    >
      {isFullScreen && (
        <Tooltip title="退出全屏" placement="bottomLeft">
          <Button
            icon={<FullscreenExitOutlined />}
            className={styles['fullscreen-icon-shrink']}
            type="text"
            onClick={toggleFullScreen}
          />
        </Tooltip>
      )}
      {!isFullScreen && (
        <Tooltip title="全屏">
          <Button
            icon={<FullscreenOutlined />}
            className={styles['fullscreen-icon-enlarge']}
            type="text"
            onClick={toggleFullScreen}
          />
        </Tooltip>
      )}
      <elements-api id="docs" router="hash" hideSchemas hideExport />
    </div>
  );
};

export default API;
