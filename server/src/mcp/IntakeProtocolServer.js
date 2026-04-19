const mongoose = require('mongoose');

/**
 * MCP Server: IntakeProtocolServer
 * Role: Reads therapist-defined intake protocol stages from MongoDB.
 * Capabilities: getStageConfig, getAllStages
 */
class IntakeProtocolServer {
  /**
   * Retrieves a single stage configuration by stage number.
   * @param {number} stageNumber - Stage 1 through 5
   * @returns {Promise<Object>} Stage config document
   */
  async getStageConfig(stageNumber) {
    try {
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB is not connected.');
      }

      const collection = mongoose.connection.db.collection('intake_protocol');
      const stage = await collection.findOne({ stageNumber });

      if (!stage) {
        throw new Error(`IntakeProtocolServer: Stage ${stageNumber} not found. Run seedIntakeProtocol.js first.`);
      }

      return stage;
    } catch (error) {
      console.error('IntakeProtocolServer - getStageConfig Error:', error.message);
      throw error;
    }
  }

  /**
   * Retrieves all 5 stage configurations, sorted by stageNumber.
   * @returns {Promise<Array<Object>>}
   */
  async getAllStages() {
    try {
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB is not connected.');
      }

      const collection = mongoose.connection.db.collection('intake_protocol');
      const stages = await collection.find({}).sort({ stageNumber: 1 }).toArray();

      return stages;
    } catch (error) {
      console.error('IntakeProtocolServer - getAllStages Error:', error.message);
      throw error;
    }
  }
}

module.exports = new IntakeProtocolServer();
