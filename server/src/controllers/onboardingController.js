const Psychologist = require('../models/Psychologist');
const User = require('../models/User');
const { audit } = require('../services/auditService');
const { notifyUser } = require('../services/notificationService');
const {
  validateProfileCompleteness,
  validateDocumentsCompleteness
} = require('../services/onboardingValidationService');

const notifyAdmins = async ({ title, message, link = '', type = 'onboarding' }) => {
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all((admins || []).map((a) => notifyUser({ userId: a._id, title, message, link, type })));
};

const transition = async ({ psychologistId, newStatus, byUserId, reason = '', details = {} }) => {
  await Psychologist.updateOne(
    { _id: psychologistId },
    {
      $push: {
        onboardingHistory: {
          status: newStatus,
          at: new Date(),
          byUserId: byUserId || null,
          reason: String(reason || ''),
          details: details || {}
        }
      }
    }
  );
};

// @GET /api/onboarding/me
exports.getMyOnboarding = async (req, res) => {
  try {
    const psychologist = await Psychologist.findOne({ userId: req.user.id })
      .select('profileStatus submittedAt lastResubmittedAt rejectionReason rejectedAt rejectionDetails onboardingHistory isApproved isRejected');
    if (!psychologist) return res.status(404).json({ message: 'Psychologist not found' });

    return res.status(200).json(psychologist);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// @POST /api/onboarding/submit
exports.submitOnboarding = async (req, res) => {
  try {
    const psychologist = await Psychologist.findOne({ userId: req.user.id });
    if (!psychologist) return res.status(404).json({ message: 'Psychologist not found' });

    const currentStatus = String(psychologist.profileStatus || 'Draft');
    if (currentStatus === 'Submitted') {
      return res.status(409).json({ message: 'Application already submitted' });
    }
    if (currentStatus === 'Approved') {
      return res.status(409).json({ message: 'Application already approved' });
    }

    // Rejected can resubmit; Draft can submit.
    const profileValidation = validateProfileCompleteness(psychologist);
    const docValidation = await validateDocumentsCompleteness({ ownerUserId: req.user.id });

    if (!profileValidation.ok || !docValidation.ok) {
      await audit(req, {
        action: currentStatus === 'Rejected' ? 'ONBOARDING_RESUBMIT' : 'ONBOARDING_SUBMIT',
        targetType: 'Psychologist',
        targetId: psychologist._id,
        outcome: 'failure',
        message: 'Incomplete application',
        metadata: { missingFields: profileValidation.missingFields, missingDocuments: docValidation.missingDocuments }
      });
      return res.status(400).json({
        message: 'Application is incomplete',
        missingFields: profileValidation.missingFields,
        missingDocuments: docValidation.missingDocuments
      });
    }

    const now = new Date();
    const isResubmission = currentStatus === 'Rejected';

    await Psychologist.updateOne(
      { _id: psychologist._id },
      {
        $set: {
          profileStatus: 'Submitted',
          submittedAt: psychologist.submittedAt || now,
          lastResubmittedAt: isResubmission ? now : psychologist.lastResubmittedAt,
          isRejected: false,
          rejectionReason: '',
          rejectedAt: null,
          rejectedByUserId: null,
          rejectionDetails: { fields: [], documents: [] }
        }
      }
    );

    await transition({
      psychologistId: psychologist._id,
      newStatus: 'Submitted',
      byUserId: req.user.id,
      reason: isResubmission ? 'Resubmitted after rejection' : 'Submitted for review'
    });

    await audit(req, {
      action: isResubmission ? 'ONBOARDING_RESUBMIT' : 'ONBOARDING_SUBMIT',
      targetType: 'Psychologist',
      targetId: psychologist._id,
      outcome: 'success'
    });

    await notifyAdmins({
      title: isResubmission ? 'Onboarding resubmitted' : 'New onboarding submission',
      message: `Psychologist onboarding application ${isResubmission ? 'resubmitted' : 'submitted'} and ready for review.`,
      link: '/admin',
      type: 'onboarding_submission'
    });

    return res.status(200).json({ message: 'Application submitted', status: 'Submitted' });
  } catch (err) {
    await audit(req, {
      action: 'ONBOARDING_SUBMIT',
      outcome: 'failure',
      message: err.message
    });
    return res.status(500).json({ message: 'Server error' });
  }
};

