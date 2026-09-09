const express = require('express');
const { prisma } = require('../lib/prisma');
const { HttpError, asyncHandler } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function assertOwnership(ownerId, petId) {
  const pet = await prisma.pet.findUnique({ where: { id: petId } });
  if (!pet || !pet.isActive) throw new HttpError(404, 'Pet not found');
  if (pet.ownerId !== ownerId) throw new HttpError(403, 'You do not own this pet');
  return pet;
}

router.get(
  '/me/pets',
  requireAuth,
  asyncHandler(async (req, res) => {
    const pets = await prisma.pet.findMany({
      where: { ownerId: req.user.id, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(pets);
  }),
);

router.post(
  '/me/pets',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name?.trim()) throw new HttpError(400, 'Pet name is required');

    const pet = await prisma.pet.create({
      data: {
        ownerId: req.user.id,
        name: body.name.trim(),
        species: body.species || 'DOG',
        breed: body.breed,
        birthdate: body.birthdate ? new Date(body.birthdate) : undefined,
        weightKg: body.weightKg,
        photoUrl: body.photoUrl,
        temperamentNotes: body.temperamentNotes,
        allergies: body.allergies,
        vaccinationStatus: body.vaccinationStatus,
        vaccinationExpiry: body.vaccinationExpiry
          ? new Date(body.vaccinationExpiry)
          : undefined,
        vetName: body.vetName,
        vetPhone: body.vetPhone,
        sizeCategory: body.sizeCategory,
      },
    });
    res.status(201).json(pet);
  }),
);

router.patch(
  '/pets/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertOwnership(req.user.id, req.params.id);
    const body = req.body || {};
    const pet = await prisma.pet.update({
      where: { id: req.params.id },
      data: {
        name: body.name?.trim(),
        species: body.species,
        breed: body.breed,
        birthdate: body.birthdate ? new Date(body.birthdate) : undefined,
        weightKg: body.weightKg,
        photoUrl: body.photoUrl,
        temperamentNotes: body.temperamentNotes,
        allergies: body.allergies,
        vaccinationStatus: body.vaccinationStatus,
        vaccinationExpiry: body.vaccinationExpiry
          ? new Date(body.vaccinationExpiry)
          : undefined,
        vetName: body.vetName,
        vetPhone: body.vetPhone,
        sizeCategory: body.sizeCategory,
      },
    });
    res.json(pet);
  }),
);

router.delete(
  '/pets/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertOwnership(req.user.id, req.params.id);
    await prisma.pet.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  }),
);

module.exports = router;
