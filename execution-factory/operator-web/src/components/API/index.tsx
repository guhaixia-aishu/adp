import { useEffect, useState } from 'react';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { Button, Tooltip } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import '@stoplight/elements/web-components.min.js';
import '@stoplight/elements/styles.min.css';
import { getConfig, getHttpBaseUrl } from '@/utils/http';
import { OperatorTypeEnum } from '@/components/OperatorList/types';
import { splitterStr, parsePathParams, parseQueryParams, transformToolInfoToOpenAPI, path2Hash } from './utils';
import styles from './index.module.less';

interface APIProps {
  operatorType: OperatorTypeEnum;
  toolInfo: any;
}

const API = ({ operatorType, toolInfo }: APIProps) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    // 设置文档
    const docsElement = document.getElementById('docs');
    const toolSpec = transformToolInfoToOpenAPI(toolInfo);
    if (isEmpty(toolSpec)) {
      return;
    }

    docsElement.apiDescriptionDocument = toolSpec;
    // 后缀字符串
    const proxySuffix = `${splitterStr}/${encodeURIComponent(`path=<${toolInfo.metadata?.path}>`)}`;
    switch (operatorType) {
      case OperatorTypeEnum.Tool:
        docsElement.tryItCorsProxy = `${getHttpBaseUrl()}/api/agent-operator-integration/v1/tool-box/${toolInfo.box_id}/tool/${toolInfo.tool_id}/debug${proxySuffix}`;
        break;

      case OperatorTypeEnum.Operator:
        docsElement.tryItCorsProxy = `${getHttpBaseUrl()}/api/agent-operator-integration/v1/operator/debug${proxySuffix}`;
        break;
    }

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
      const regexs = {
        [OperatorTypeEnum.Tool]: new RegExp(
          `/api/agent-operator-integration/v1/tool-box/(.*)/tool/(.*)/debug${splitterStr}/`
        ),
        [OperatorTypeEnum.Operator]: new RegExp(`/api/agent-operator-integration/v1/operator/debug${splitterStr}/`),
      };

      if (regexs[operatorType].test(url)) {
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
          ...(operatorType === OperatorTypeEnum.Operator
            ? { operator_id: toolInfo.operator_id, version: toolInfo.version }
            : {}),
        });
        options.headers = {
          Authorization: 'Bearer ' + getConfig('getToken')(),
        };
        options.method = 'POST';
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
