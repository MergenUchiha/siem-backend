import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { IncidentStatus, IncidentSeverity } from './dto/incident.dto';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    incident: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new incident', async () => {
      const createIncidentDto = {
        title: 'Test Incident',
        severity: IncidentSeverity.HIGH,
        affectedSystems: ['Web Server', 'Database'],
        description: 'Test description',
        tags: ['test', 'security'],
      };

      const expectedIncident = {
        id: '123',
        ...createIncidentDto,
        status: IncidentStatus.OPEN,
        timestamp: new Date(),
        assignedTo: null,
        resolvedAt: null,
        updatedAt: new Date(),
      };

      mockPrismaService.incident.create.mockResolvedValue(expectedIncident);

      const result = await service.create(createIncidentDto);

      expect(result).toEqual(expectedIncident);
      expect(mockPrismaService.incident.create).toHaveBeenCalledWith({
        data: {
          ...createIncidentDto,
          status: IncidentStatus.OPEN,
          tags: createIncidentDto.tags,
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return all incidents', async () => {
      const mockIncidents = [
        {
          id: '1',
          title: 'Incident 1',
          severity: 'high',
          status: 'open',
          affectedSystems: ['Web Server'],
          description: 'Test 1',
          timestamp: new Date(),
          assignedTo: null,
          tags: [],
          resolvedAt: null,
          updatedAt: new Date(),
        },
        {
          id: '2',
          title: 'Incident 2',
          severity: 'medium',
          status: 'investigating',
          affectedSystems: ['Database'],
          description: 'Test 2',
          timestamp: new Date(),
          assignedTo: null,
          tags: [],
          resolvedAt: null,
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.incident.findMany.mockResolvedValue(mockIncidents);

      const result = await service.findAll({});

      expect(result).toEqual(mockIncidents);
      expect(mockPrismaService.incident.findMany).toHaveBeenCalled();
    });

    it('should filter incidents by status', async () => {
      mockPrismaService.incident.findMany.mockResolvedValue([]);

      await service.findAll({ status: IncidentStatus.OPEN });

      expect(mockPrismaService.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: IncidentStatus.OPEN,
          }),
        }),
      );
    });

    it('should filter incidents by severity', async () => {
      mockPrismaService.incident.findMany.mockResolvedValue([]);

      await service.findAll({ severity: IncidentSeverity.CRITICAL });

      expect(mockPrismaService.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: IncidentSeverity.CRITICAL,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single incident', async () => {
      const mockIncident = {
        id: '123',
        title: 'Test Incident',
        severity: 'high',
        status: 'open',
        affectedSystems: ['Web Server'],
        description: 'Test',
        timestamp: new Date(),
        assignedTo: null,
        tags: [],
        resolvedAt: null,
        updatedAt: new Date(),
      };

      mockPrismaService.incident.findUnique.mockResolvedValue(mockIncident);

      const result = await service.findOne('123');

      expect(result).toEqual(mockIncident);
    });

    it('should throw NotFoundException if incident not found', async () => {
      mockPrismaService.incident.findUnique.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an incident', async () => {
      const existingIncident = {
        id: '123',
        title: 'Old Title',
        severity: 'high',
        status: 'open',
        affectedSystems: ['Web Server'],
        description: 'Old description',
        timestamp: new Date(),
        assignedTo: null,
        tags: [],
        resolvedAt: null,
        updatedAt: new Date(),
      };

      const updateDto = {
        status: IncidentStatus.RESOLVED,
        description: 'Updated description',
      };

      const updatedIncident = {
        ...existingIncident,
        ...updateDto,
        resolvedAt: new Date(),
      };

      mockPrismaService.incident.findUnique.mockResolvedValue(existingIncident);
      mockPrismaService.incident.update.mockResolvedValue(updatedIncident);

      const result = await service.update('123', updateDto);

      expect(result).toEqual(updatedIncident);
      expect(mockPrismaService.incident.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: expect.objectContaining({
          status: IncidentStatus.RESOLVED,
          resolvedAt: expect.any(Date),
        }),
      });
    });

    it('should throw NotFoundException if incident not found', async () => {
      mockPrismaService.incident.findUnique.mockResolvedValue(null);

      await expect(
        service.update('999', { status: IncidentStatus.RESOLVED }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an incident', async () => {
      const mockIncident = {
        id: '123',
        title: 'Test',
        severity: 'high',
        status: 'open',
        affectedSystems: [],
        description: 'Test',
        timestamp: new Date(),
        assignedTo: null,
        tags: [],
        resolvedAt: null,
        updatedAt: new Date(),
      };

      mockPrismaService.incident.findUnique.mockResolvedValue(mockIncident);
      mockPrismaService.incident.delete.mockResolvedValue(mockIncident);

      const result = await service.remove('123');

      expect(result).toEqual(mockIncident);
      expect(mockPrismaService.incident.delete).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });
  });

  describe('getStats', () => {
    it('should return incident statistics', async () => {
      mockPrismaService.incident.count.mockResolvedValue(50);
      mockPrismaService.incident.groupBy
        .mockResolvedValueOnce([
          { status: 'open', _count: 10 },
          { status: 'investigating', _count: 15 },
          { status: 'resolved', _count: 20 },
          { status: 'closed', _count: 5 },
        ])
        .mockResolvedValueOnce([
          { severity: 'critical', _count: 8 },
          { severity: 'high', _count: 12 },
          { severity: 'medium', _count: 18 },
          { severity: 'low', _count: 12 },
        ]);

      const result = await service.getStats();

      expect(result).toEqual({
        total: 50,
        statusCounts: {
          open: 10,
          investigating: 15,
          resolved: 20,
          closed: 5,
        },
        severityCounts: {
          critical: 8,
          high: 12,
          medium: 18,
          low: 12,
        },
      });
    });
  });
});