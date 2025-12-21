import { Test, TestingModule } from '@nestjs/testing';
import { LogsService } from './logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { SeverityLevel } from './dto/create-log.dto';

describe('LogsService', () => {
  let service: LogsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    log: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LogsService>(LogsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new log', async () => {
      const createLogDto = {
        source: 'Web Server',
        severity: 'high' as SeverityLevel,
        message: 'Test log message',
        ip: '192.168.1.1',
        action: 'Login Attempt',
      };

      const expectedLog = {
        id: '123',
        timestamp: new Date(),
        ...createLogDto,
        user: null,
        details: null,
      };

      mockPrismaService.log.create.mockResolvedValue(expectedLog);

      const result = await service.create(createLogDto);

      expect(result).toEqual(expectedLog);
      expect(mockPrismaService.log.create).toHaveBeenCalledWith({
        data: createLogDto,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated logs', async () => {
      const mockLogs = [
        {
          id: '1',
          source: 'Web Server',
          severity: 'high',
          message: 'Test 1',
          ip: '192.168.1.1',
          action: 'Login',
          timestamp: new Date(),
          user: null,
          details: null,
        },
        {
          id: '2',
          source: 'Database',
          severity: 'medium',
          message: 'Test 2',
          ip: '192.168.1.2',
          action: 'Query',
          timestamp: new Date(),
          user: null,
          details: null,
        },
      ];

      mockPrismaService.log.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.log.count.mockResolvedValue(2);

      const result = await service.findAll({
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        data: mockLogs,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should filter logs by severity', async () => {
      const mockLogs = [
        {
          id: '1',
          source: 'Web Server',
          severity: 'critical',
          message: 'Critical issue',
          ip: '192.168.1.1',
          action: 'Login',
          timestamp: new Date(),
          user: null,
          details: null,
        },
      ];

      mockPrismaService.log.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.log.count.mockResolvedValue(1);

      await service.findAll({
        severity: 'critical' as SeverityLevel,
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: 'critical',
          }),
        }),
      );
    });

    it('should search logs by text', async () => {
      mockPrismaService.log.findMany.mockResolvedValue([]);
      mockPrismaService.log.count.mockResolvedValue(0);

      await service.findAll({
        search: 'test search',
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single log', async () => {
      const mockLog = {
        id: '123',
        source: 'Web Server',
        severity: 'high',
        message: 'Test log',
        ip: '192.168.1.1',
        action: 'Login',
        timestamp: new Date(),
        user: null,
        details: null,
      };

      mockPrismaService.log.findUnique.mockResolvedValue(mockLog);

      const result = await service.findOne('123');

      expect(result).toEqual(mockLog);
      expect(mockPrismaService.log.findUnique).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });
  });

  describe('getSources', () => {
    it('should return unique log sources', async () => {
      const mockSources = [
        { source: 'Web Server' },
        { source: 'Database' },
        { source: 'Firewall' },
      ];

      mockPrismaService.log.findMany.mockResolvedValue(mockSources);

      const result = await service.getSources();

      expect(result).toEqual(['Web Server', 'Database', 'Firewall']);
    });
  });

  describe('getStats', () => {
    it('should return log statistics', async () => {
      mockPrismaService.log.count.mockResolvedValue(100);
      mockPrismaService.log.groupBy.mockResolvedValue([
        { severity: 'critical', _count: 10 },
        { severity: 'high', _count: 20 },
        { severity: 'medium', _count: 30 },
        { severity: 'low', _count: 25 },
        { severity: 'info', _count: 15 },
      ]);

      const result = await service.getStats();

      expect(result).toEqual({
        total: 100,
        severityCounts: {
          critical: 10,
          high: 20,
          medium: 30,
          low: 25,
          info: 15,
        },
      });
    });
  });

  describe('deleteOld', () => {
    it('should delete logs older than specified days', async () => {
      const mockResult = { count: 5 };
      mockPrismaService.log.deleteMany.mockResolvedValue(mockResult);

      const result = await service.deleteOld(90);

      expect(result).toEqual(mockResult);
      expect(mockPrismaService.log.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.any(Object),
          }),
        }),
      );
    });
  });
});