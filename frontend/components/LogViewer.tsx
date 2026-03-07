import React, { useEffect, useState, useRef } from 'react';
import { Terminal, RefreshCw, Filter, Pause, Play, Trash2 } from 'lucide-react';

interface LogEntry {
  time: string;
  level: string;
  module: string;
  message: string;
}

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 获取历史日志
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8080/api/bridge/logs?lines=100&level=${levelFilter}`);
      const data = await response.json();
      if (data.ok) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('获取日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 启动实时日志流
  const startStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('http://localhost:8080/api/bridge/logs/stream');
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.log) {
          // 解析日志格式
          const parts = data.log.split(' | ');
          const entry: LogEntry = {
            time: parts[0] || '',
            level: parts[1] || 'INFO',
            module: parts[2] || '',
            message: parts.slice(3).join(' | ') || data.log
          };
          
          setLogs(prev => {
            const newLogs = [...prev, entry];
            // 保留最近500条
            return newLogs.slice(-500);
          });
        }
      } catch (err) {
        console.error('解析日志失败:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('日志流连接失败');
      setIsStreaming(false);
    };

    eventSourceRef.current = eventSource;
    setIsStreaming(true);
  };

  // 停止实时日志流
  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  // 清空日志
  const clearLogs = () => {
    setLogs([]);
  };

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // 初始加载
  useEffect(() => {
    fetchLogs();
    startStreaming();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [levelFilter]);

  // 获取日志级别颜色
  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'text-red-500 bg-red-50';
      case 'WARNING':
        return 'text-yellow-600 bg-yellow-50';
      case 'INFO':
        return 'text-blue-500 bg-blue-50';
      case 'DEBUG':
        return 'text-gray-500 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-900 rounded-lg">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">后端日志</h3>
            <p className="text-xs text-gray-500">实时监控后端运行状态</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 级别过滤 */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部</option>
            <option value="error">错误</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
            <option value="debug">调试</option>
          </select>
          
          {/* 流控制 */}
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Pause className="w-4 h-4" />
              暂停
            </button>
          ) : (
            <button
              onClick={startStreaming}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Play className="w-4 h-4" />
              开始
            </button>
          )}
          
          {/* 刷新 */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          {/* 清空 */}
          <button
            onClick={clearLogs}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* 日志内容 */}
      <div
        ref={logContainerRef}
        className="h-80 overflow-y-auto bg-gray-900 p-4 font-mono text-xs"
        style={{ fontFamily: 'Consolas, Monaco, monospace' }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            暂无日志
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className="flex items-start gap-2 py-1 hover:bg-gray-800/50 px-2 -mx-2 rounded"
            >
              {/* 时间 */}
              <span className="text-gray-500 shrink-0 w-36">{log.time}</span>
              
              {/* 级别 */}
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${getLevelColor(log.level)}`}
              >
                {log.level.padEnd(5)}
              </span>
              
              {/* 模块 */}
              {log.module && (
                <span className="text-purple-400 shrink-0">[{log.module}]</span>
              )}
              
              {/* 消息 */}
              <span className="text-gray-300 break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
      
      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>共 {logs.length} 条日志</span>
          <span className={isStreaming ? 'text-green-500' : 'text-gray-400'}>
            {isStreaming ? '● 实时监控中' : '○ 已暂停'}
          </span>
        </div>
        
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300"
          />
          自动滚动
        </label>
      </div>
    </div>
  );
};

export default LogViewer;