export const splitterStr = '/api-web-proxy';

// 将 toolInfo 转成 OpenAPI 3.0 结构
export const transformToolInfoToOpenAPI = (toolInfo: any) => {
  if (!toolInfo.metadata?.api_spec) {
    return {};
  }
  const openAPI = {
    openapi: '3.0.0',
    info: {
      title: toolInfo.name,
      description: toolInfo.description || toolInfo.metadata?.description,
    },
    paths: {
      [toolInfo.metadata?.path]: {
        [(toolInfo.metadata?.method as string).toLowerCase()]: {
          ...toolInfo.metadata?.api_spec,
          summary: toolInfo.name,
          description: toolInfo.description || toolInfo.metadata?.description,
          requestBody: toolInfo.metadata?.api_spec?.request_body,
          responses: toolInfo.metadata?.api_spec?.responses.reduce((prev, response) => {
            return {
              ...prev,
              [response.status_code]: response,
            };
          }, {}),
        },
      },
    },
    components: toolInfo.metadata?.api_spec?.components,
    servers: [
      {
        url: toolInfo.metadata?.server_url,
        // url: `${getHttpBaseUrl()}/api/agent-operator-integration/v1/tool-box/${toolInfo.box_id}/tool/${toolInfo.tool_id}/debug${splitterStr}/${encodeURIComponent(`path=<${toolInfo.metadata?.path}>`)}/`,
      },
    ],
  };

  return openAPI;
};

// 解析url中的查询参数
export function parseQueryParams(url: string) {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return {};

  const queryString = url.substring(queryStart + 1);
  const params = new URLSearchParams(queryString);

  const result = {};

  // 遍历所有参数名
  for (const key of params.keys()) {
    const values = params.getAll(key);
    // 如果只有一个值，直接存储；如果有多个值，存储数组
    result[key] = values.length === 1 ? values[0] : values;
  }

  return result;
}

// 解析url中的路径参数
export function parsePathParams(url: string) {
  // 从字符串中提取模板和实际路径
  const match = decodeURIComponent(url).match(/path=<([^>]+)>(.+)/);
  if (!match) return {};

  const templatePath = match[1];
  const actualPath = match[2];

  const templateParts = templatePath.split('/');
  const actualParts = actualPath.split('/');

  const params = {};

  for (let i = 0; i < templateParts.length; i++) {
    const templatePart = templateParts[i];
    const actualPart = actualParts[i];

    // 检查是否是参数占位符 {param_name}
    if (templatePart.startsWith('{') && templatePart.endsWith('}')) {
      const paramName = templatePart.slice(1, -1);
      params[paramName] = actualPart;
    }
  }

  return params;
}

// 将path转换成hash路由(@stoplight/elements需要)
export const path2Hash = (path: string, method: string) => {
  return (
    '/paths/' +
    path
      .replace(/\/|{|}|\s/g, '-')
      .replace(/-{2,}/, '-')
      .replace(/^-/, '')
      .replace(/-$/, '') +
    '/' +
    method
  );
};

// 从openapi中解析出url
export const parseUrlFromOpenAPI = (spec: any) => {
  const [path] = Object.keys(spec?.paths || {});
  const server = spec?.servers?.[0]?.url || '';

  return server + path || '';
};

// 从头openapi中解析出请求方法
export const parseHttpMethod = (spec: any) => {
  const [path] = Object.keys(spec?.paths || {});
  if (!path) return '';

  const [method] = Object.keys(spec?.paths?.[path] || {});

  return method || '';
};

// 根据path template和实际请求的path获取path参数
export const parsePathParamsFromUrl = (templateUrl: string, actualUrl: string) => {
  const templateParts = templateUrl.split('/');
  const actualParts = actualUrl.split('/');

  const params = {};

  for (let i = 0; i < templateParts.length; i++) {
    const templatePart = templateParts[i];
    const actualPart = actualParts[i];

    // 检查是否是参数占位符 {param_name}
    if (templatePart.startsWith('{') && templatePart.endsWith('}')) {
      const paramName = templatePart.slice(1, -1);
      params[paramName] = actualPart;
    }
  }

  return params;
};
